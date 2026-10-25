"use client";
import { ArrowRight, MessagesSquare } from "lucide-react";
import { PEOPLE, type PersonId, type World } from "@/lib/research-institute";
import { currentExchanges } from "@/lib/institute-teamwork";
import { presentThemeText } from "@/lib/institute-theme-presentation";
import type { SimulationTheme } from "@/lib/institute-themes";

export function InstituteTeamwork({ world, theme = "research", onSelect }: { world: World; theme?: SimulationTheme; onSelect: (id: PersonId) => void }) {
  const exchanges = currentExchanges(world);
  const name = (id: PersonId) => PEOPLE.find(person => person.id === id)!.name.split(" ")[0];
  const present = (text: string) => presentThemeText(theme, text);
  return <details className="institute-teamwork">
    <summary><MessagesSquare size={15}/><strong>Team exchanges</strong><span>{exchanges.length ? `${exchanges.length} recorded this round` : "Advance a round to see the team connect"}</span></summary>
    <p>Recorded requests, handoffs and reviews. Select a person to highlight their communication traces in the room.</p>
    <ol aria-label="Team exchanges this round">
      {exchanges.slice().reverse().map(exchange => <li key={exchange.id} data-exchange={exchange.id}>
        <div><button onClick={() => onSelect(exchange.from)}>{name(exchange.from)}</button><ArrowRight size={13}/><button onClick={() => onSelect(exchange.to)}>{name(exchange.to)}</button><small>{exchange.kind}</small></div>
        <p>{present(exchange.subject)}</p><span>{present(exchange.detail)}</span>
      </li>)}
    </ol>
    {!exchanges.length && <p>{present(world.round ? "No structured exchange was recorded in this round. Earlier sessions keep their original event history below." : "Funding requests, experiment handoffs and support appear here when agents perform those actions.")}</p>}
  </details>;
}
