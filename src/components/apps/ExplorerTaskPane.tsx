import { useState, type ReactNode } from "react";
import { Icon, cls } from "../../lib/ui";

interface Task {
  label: string;
  icon: string;
  onClick: () => void;
}
export interface Section {
  title: string;
  tasks?: Task[];
  body?: ReactNode;
}

/** XP's blue left pane: collapsible boxes of context-dependent links. */
export function TaskPane({ sections }: { sections: Section[] }) {
  const [closed, setClosed] = useState<string[]>([]);
  return (
    <aside className="taskpane">
      {sections
        .filter((s) => s.tasks?.length || s.body)
        .map((s) => {
          const shut = closed.includes(s.title);
          return (
            <section key={s.title} className="task-box">
              <header onClick={() => setClosed(shut ? closed.filter((t) => t !== s.title) : [...closed, s.title])}>
                {s.title}
                <span className={cls("chevron", shut && "down")} />
              </header>
              {!shut && (
                <div className="task-body">
                  {s.tasks?.map((t) => (
                    <button key={t.label} className="task-link" onClick={t.onClick}>
                      <Icon name={t.icon} />
                      {t.label}
                    </button>
                  ))}
                  {s.body}
                </div>
              )}
            </section>
          );
        })}
    </aside>
  );
}
