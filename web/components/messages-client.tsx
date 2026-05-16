"use client";

import { useState, useEffect, useRef } from "react";

type MsgUser = {
  id: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  image: string | null;
};

type Message = {
  id: string;
  fromUserId: string;
  toUserId: string;
  body: string;
  read: boolean;
  flagged: boolean;
  createdAt: string;
  from: MsgUser;
  to: MsgUser;
};

function Avatar({ user }: { user: MsgUser }) {
  const src = user.avatarUrl ?? user.image;
  const initials = (user.name ?? user.username ?? "?")[0].toUpperCase();
  if (src) {
    return (
      <img src={src} alt={user.name ?? ""} className="h-8 w-8 rounded-full object-cover" />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-medium">
      {initials}
    </div>
  );
}

function displayName(u: MsgUser) {
  return u.username ? `@${u.username}` : (u.name ?? "Unknown");
}

export function MessagesClient({
  currentUserId,
  initialMessages,
}: {
  currentUserId: string;
  initialMessages: Message[];
}) {
  // Build conversation list from initial messages
  const getPartner = (m: Message): MsgUser =>
    m.fromUserId === currentUserId ? m.to : m.from;

  const seen = new Set<string>();
  const conversations = initialMessages.filter((m) => {
    const partner = m.fromUserId === currentUserId ? m.toUserId : m.fromUserId;
    if (seen.has(partner)) return false;
    seen.add(partner);
    return true;
  });

  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(
    conversations[0] ? (conversations[0].fromUserId === currentUserId ? conversations[0].toUserId : conversations[0].fromUserId) : null
  );
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Get partner user object from conversations
  const selectedPartner = conversations.find((m) => {
    const pid = m.fromUserId === currentUserId ? m.toUserId : m.fromUserId;
    return pid === selectedPartnerId;
  });
  const selectedPartnerUser = selectedPartner ? getPartner(selectedPartner) : null;

  useEffect(() => {
    if (!selectedPartnerId) return;
    setLoadingThread(true);
    fetch(`/api/messages?with=${selectedPartnerId}`)
      .then((r) => r.json())
      .then((d) => setThreadMessages(d.messages ?? []))
      .finally(() => setLoadingThread(false));
  }, [selectedPartnerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [threadMessages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedPartnerId) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId: selectedPartnerId, body: newMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Failed to send message.");
      } else {
        setThreadMessages((prev) => [
          ...prev,
          { ...data.message, createdAt: data.message.createdAt, from: { id: currentUserId, name: null, username: null, avatarUrl: null, image: null }, to: selectedPartnerUser ?? { id: selectedPartnerId, name: null, username: null, avatarUrl: null, image: null } },
        ]);
        setNewMessage("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card flex h-[600px] overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r border-bg-border flex flex-col">
        <div className="border-b border-bg-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="px-4 py-6 text-sm text-text-muted">No conversations yet.</p>
          )}
          {conversations.map((m) => {
            const partner = getPartner(m);
            const partnerId = m.fromUserId === currentUserId ? m.toUserId : m.fromUserId;
            const isUnread = !m.read && m.toUserId === currentUserId;
            const isActive = partnerId === selectedPartnerId;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedPartnerId(partnerId)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                  isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
                }`}
              >
                <Avatar user={partner} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className={`truncate text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>
                      {displayName(partner)}
                    </p>
                    {isUnread && (
                      <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-white" />
                    )}
                  </div>
                  <p className="truncate text-xs text-text-muted">{m.body}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread panel */}
      <div className="flex flex-1 flex-col min-w-0">
        {!selectedPartnerId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
            Select a conversation to read messages.
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="border-b border-bg-border px-5 py-3 flex items-center gap-3">
              {selectedPartnerUser && <Avatar user={selectedPartnerUser} />}
              <p className="font-medium">
                {selectedPartnerUser ? displayName(selectedPartnerUser) : "..."}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingThread && (
                <p className="text-center text-sm text-text-muted">Loading...</p>
              )}
              {!loadingThread && threadMessages.length === 0 && (
                <p className="text-center text-sm text-text-muted">No messages yet.</p>
              )}
              {threadMessages.map((msg) => {
                const isMine = msg.fromUserId === currentUserId;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                        isMine
                          ? "bg-white text-bg rounded-br-sm"
                          : "bg-white/10 text-text rounded-bl-sm"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                      <p className={`mt-1 text-[10px] ${isMine ? "text-bg/60" : "text-text-muted"}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Compose */}
            <div className="border-t border-bg-border px-5 py-3">
              {sendError && <p className="mb-2 text-xs text-red-400">{sendError}</p>}
              <form onSubmit={handleSend} className="flex items-end gap-3">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e as any);
                    }
                  }}
                  placeholder="Type a message... (Enter to send)"
                  rows={2}
                  className="input flex-1 resize-none text-sm"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-bg transition hover:bg-white/90 disabled:opacity-50"
                >
                  {sending ? "..." : "Send"}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
