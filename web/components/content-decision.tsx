"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, ArrowRight, Check, GitFork, Trash2 } from "lucide-react";
import {
  contentId,
  decisionPlan,
  type ContentDocument,
  type ContentRecordView,
  type DecisionDocument,
  type DecisionOption,
} from "@/lib/content-workspace";
import { Guide, Field, EvidenceEditor } from "./content-fields";
import { contentRequest } from "./content-workbench";
export function DecisionWorkspace({
  value,
  onChange,
  record,
  save,
  onCommitted,
}: {
  value: DecisionDocument;
  onChange: (d: DecisionDocument) => void;
  record: ContentRecordView | null;
  save: (d?: ContentDocument) => Promise<ContentRecordView | null>;
  onCommitted: (r: ContentRecordView) => void;
}) {
  const [error, setError] = useState(""),
    [committing, setCommitting] = useState(false);
  const chosen = value.options.find((o) => o.id === value.selected);
  const money = (n: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: value.currency,
      maximumFractionDigits: 0,
    }).format(n);
  function option(id: string, p: Partial<DecisionOption>) {
    onChange({
      ...value,
      options: value.options.map((o) => (o.id === id ? { ...o, ...p } : o)),
    });
  }
  async function commit() {
    setError("");
    setCommitting(true);
    try {
      decisionPlan("Decision", value);
      const saved = await save();
      if (!saved) return;
      const data = await contentRequest(
        `/api/content/${saved.id}/commit`,
        "POST",
        { version: saved.version },
      );
      onCommitted(data.record);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCommitting(false);
    }
  }
  return (
    <fieldset className="cw-module" disabled={committing}>
      <Guide
        targets={["decision-question", "decision-options", "decision-commit"]}
        complete={[!!value.question.trim() && value.options.filter(o => o.title.trim()).length >= 2, !!chosen?.tasks.filter(t => t.trim()).length && !!value.reviewDate, !!record?.planId]}
        steps={[
          "Write your decision and at least two alternatives",
          "Add evidence, costs, tradeoffs and tasks",
          "Choose one, create a plan and schedule a review",
        ]}
      />
      <section className="cw-decision-question" id="decision-question" tabIndex={-1}>
        <GitFork size={26} />
        <Field label="What decision are you making?">
          <textarea
            className="input"
            rows={2}
            value={value.question}
            maxLength={1000}
            placeholder="e.g. Where should we focus our next two weeks?"
            onChange={(e) => onChange({ ...value, question: e.target.value })}
          />
        </Field>
      </section>
      <div className="cw-three">
        <Field label="Available budget (your assumption)">
          <input
            className="input"
            type="number"
            min={0}
            max={1e9}
            value={value.budget}
            onChange={(e) =>
              onChange({ ...value, budget: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Currency">
          <select
            className="input"
            value={value.currency}
            onChange={(e) =>
              onChange({
                ...value,
                currency: e.target.value as DecisionDocument["currency"],
              })
            }
          >
            <option>GBP</option>
            <option>USD</option>
            <option>EUR</option>
          </select>
        </Field>
        <Field label="When will you review the outcome?">
          <input
            className="input"
            type="date"
            value={value.reviewDate}
            onChange={(e) => onChange({ ...value, reviewDate: e.target.value })}
          />
        </Field>
      </div>
      <div className="cw-row cw-section-heading">
        <h2>Compare your alternatives</h2>
        <button
          type="button"
          className="btn-secondary"
          disabled={value.options.length >= 6 || !!record?.planId}
          onClick={() =>
            onChange({
              ...value,
              options: [
                ...value.options,
                {
                  id: contentId(),
                  title: "",
                  cost: 0,
                  days: 1,
                  tradeoffs: "",
                  requirements: "",
                  tasks: [],
                },
              ],
            })
          }
        >
          <Plus size={14} /> Add option
        </button>
      </div>
      <div className="cw-decision-options" id="decision-options" tabIndex={-1}>
        {value.options.map((o, i) => (
          <section
            key={o.id}
            className={`cw-panel cw-option ${value.selected === o.id ? "cw-option-selected" : ""}`}
          >
            <div className="cw-row">
              <h3>
                Option {String.fromCharCode(65 + i)}
              </h3>
              <button
                type="button"
                className="cw-option-select"
                disabled={!!record?.planId}
                aria-pressed={value.selected === o.id}
                onClick={() => onChange({ ...value, selected: o.id })}
              >
                {value.selected === o.id ? (
                  <>
                    <Check size={13} /> Chosen
                  </>
                ) : (
                  "Choose this"
                )}
              </button>
            </div>
            <Field label="What would you do?">
              <input
                className="input"
                value={o.title}
                maxLength={200}
                onChange={(e) => option(o.id, { title: e.target.value })}
              />
            </Field>
            <div className="cw-two">
              <Field label="Estimated cost">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={1e9}
                  value={o.cost}
                  onChange={(e) =>
                    option(o.id, { cost: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Estimated workdays">
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={3650}
                  step={1}
                  value={o.days}
                  onChange={(e) =>
                    option(o.id, { days: Number(e.target.value) })
                  }
                />
              </Field>
            </div>
            <Field label="Requirements / missing information">
              <textarea
                className="input"
                rows={3}
                value={o.requirements}
                maxLength={3000}
                onChange={(e) => option(o.id, { requirements: e.target.value })}
              />
            </Field>
            <Field label="Tradeoffs / what this does not solve">
              <textarea
                className="input"
                rows={3}
                value={o.tradeoffs}
                maxLength={3000}
                onChange={(e) => option(o.id, { tradeoffs: e.target.value })}
              />
            </Field>
            <Field
              label="Tasks in order, one per line"
              hint="These become task cards in Plans when you commit this option."
            >
              <textarea
                className="input"
                rows={4}
                value={o.tasks.join("\n")}
                onChange={(e) =>
                  option(o.id, {
                    tasks: e.target.value.split("\n").slice(0, 20),
                  })
                }
                onBlur={() =>
                  option(o.id, {
                    tasks: o.tasks.map((t) => t.trim()).filter(Boolean),
                  })
                }
              />
            </Field>
            <p className="cw-help">
              {o.cost <= value.budget
                ? `${money(value.budget - o.cost)} remains after this estimate.`
                : `${money(o.cost - value.budget)} over your stated budget.`}
            </p>
            {value.options.length > 2 && !record?.planId && (
              <button
                type="button"
                className="cw-text-button"
                onClick={() =>
                  onChange({
                    ...value,
                    options: value.options.filter((x) => x.id !== o.id),
                    selected: value.selected === o.id ? "" : value.selected,
                  })
                }
              >
                <Trash2 size={12} /> Remove option
              </button>
            )}
          </section>
        ))}
      </div>
      <EvidenceEditor
        value={value.evidence}
        onChange={(e) => onChange({ ...value, evidence: e })}
      />
      <p className="cw-help">
        Costs and time are assumptions you supply. Budget checks use arithmetic;
        they do not predict revenue or business performance.
      </p>
      {record?.planId ? (
        <div className="cw-commit-panel" id="decision-commit" tabIndex={-1}>
          <div>
            <h2>Decision committed</h2>
            <p>
              The linked plan is a snapshot of the option and tasks at
              commitment. Later notes here do not silently change that plan.
            </p>
          </div>
          <Link
            className="btn-primary"
            href={`/dashboard/plans/${record.planId}`}
          >
            Open linked plan <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="cw-commit-panel" id="decision-commit" tabIndex={-1}>
          <div>
            <h2>{chosen?.title || "Choose an option to continue"}</h2>
            <p>
              {chosen
                ? `${money(chosen.cost)} estimated cost · ${chosen.days} workdays · ${chosen.tasks.filter(Boolean).length} planned tasks`
                : "Select an alternative above, add its tasks and set a review date."}
            </p>
          </div>
          <button
            type="button"
            className="btn-primary"
            disabled={committing || !chosen || chosen.cost > value.budget}
            onClick={() => void commit()}
          >
            {committing ? "Creating plan…" : "Save decision & create plan"}{" "}
            <ArrowRight size={15} />
          </button>
        </div>
      )}
      {error && (
        <p className="cw-error" role="alert">
          {error}
        </p>
      )}
      <section className="cw-panel cw-section-heading">
        <h2>Return here to close the loop</h2>
        <Field
          label="What actually happened?"
          hint="Record the outcome, the evidence and what you would change next time. Save changes above."
        >
          <textarea
            className="input"
            rows={4}
            maxLength={4000}
            value={value.outcome}
            onChange={(e) => onChange({ ...value, outcome: e.target.value })}
          />
        </Field>
      </section>
    </fieldset>
  );
}
