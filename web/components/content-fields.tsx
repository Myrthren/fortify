import type { ReactNode } from "react";
import { contentId, type Evidence } from "@/lib/content-workspace";
import { Plus, Trash2, ExternalLink } from "lucide-react";
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="cw-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Guide({ steps }: { steps: string[] }) {
  return (
    <ol className="cw-guide" aria-label="How to use this workspace">
      {steps.map((s, i) => (
        <li key={s}>
          <span>{i + 1}</span>
          {s}
        </li>
      ))}
    </ol>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="cw-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function EvidenceEditor({
  value,
  onChange,
}: {
  value: Evidence[];
  onChange: (value: Evidence[]) => void;
}) {
  return (
    <details className="cw-evidence-editor">
      <summary>
        Supporting evidence <span>{value.length} attached</span>
      </summary>
      <p className="cw-help">
        Add facts you can support. A URL is optional for private interviews;
        keep names anonymous if needed.
      </p>
      {value.map((e, i) => (
        <div className="cw-evidence-row" key={i}>
          <div className="cw-two">
            <Field label="Evidence title">
              <input
                className="input"
                value={e.title}
                maxLength={200}
                onChange={(x) =>
                  onChange(
                    value.map((v, j) =>
                      j === i ? { ...v, title: x.target.value } : v,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Source / attribution">
              <input
                className="input"
                value={e.source}
                maxLength={200}
                onChange={(x) =>
                  onChange(
                    value.map((v, j) =>
                      j === i ? { ...v, source: x.target.value } : v,
                    ),
                  )
                }
              />
            </Field>
          </div>
          <Field label="Exact excerpt or supplied fact">
            <textarea
              className="input"
              rows={2}
              value={e.excerpt}
              maxLength={4000}
              onChange={(x) =>
                onChange(
                  value.map((v, j) =>
                    j === i ? { ...v, excerpt: x.target.value } : v,
                  ),
                )
              }
            />
          </Field>
          <div className="cw-two">
            <Field label="Source URL (optional)">
              <input
                className="input"
                type="url"
                value={e.url}
                onChange={(x) =>
                  onChange(
                    value.map((v, j) =>
                      j === i ? { ...v, url: x.target.value } : v,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Observation date">
              <input
                className="input"
                type="date"
                value={e.date}
                onChange={(x) =>
                  onChange(
                    value.map((v, j) =>
                      j === i ? { ...v, date: x.target.value } : v,
                    ),
                  )
                }
              />
            </Field>
          </div>
          <div className="cw-row">
            {e.url && /^https?:\/\//.test(e.url) && (
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="cw-link"
              >
                Open source <ExternalLink size={12} />
              </a>
            )}
            <button
              type="button"
              className="cw-text-button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 size={13} /> Remove evidence
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn-secondary"
        disabled={value.length >= 30}
        onClick={() =>
          onChange([
            ...value,
            {
              title: "",
              excerpt: "",
              source: "",
              url: "",
              date: new Date().toISOString().slice(0, 10),
            },
          ])
        }
      >
        <Plus size={14} /> Add evidence
      </button>
    </details>
  );
}
export const newId = contentId;
