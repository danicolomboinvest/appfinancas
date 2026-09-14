import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import type { WeeklyTask } from "@/lib/insights/weekly-tasks";
import { Card } from "@/components/ui/Card";

/**
 * Checklist da semana. Cada item é um link pra tela onde a coisa se resolve — a lista não é
 * decoração, é atalho. Os já resolvidos ficam marcados e apagados no topo da leitura, pra dar
 * a sensação de progresso sem roubar a atenção do que ainda falta.
 */
export function WeeklyTasksCard({ tasks }: { tasks: WeeklyTask[] }) {
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium text-ink">O que fazer esta semana</h2>
        <p className="text-caption tabular-nums text-ink-faint">
          {doneCount} de {tasks.length}
        </p>
      </div>

      <ul className="flex flex-col">
        {tasks.map((task) => (
          <li key={task.key}>
            <Link
              href={task.href}
              className="group flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  task.done ? "border-success bg-success-soft text-success" : "border-border-strong text-transparent"
                }`}
              >
                <Check size={12} strokeWidth={3} />
              </span>
              <span className={`min-w-0 flex-1 text-sm ${task.done ? "text-ink-faint line-through" : "text-ink"}`}>
                {task.label}
              </span>
              <ChevronRight
                size={15}
                className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
