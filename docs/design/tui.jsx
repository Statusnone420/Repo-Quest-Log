// TUI surface — mimics a real terminal running the Ink-based TUI
const tuiColors = {
  bg: "#0a0b0d",
  chrome: "#16181c",
  ink: "#d0d6de",
  dim: "#5f6670",
  accent: "#7fd3c4",
  mag: "#c397d8",
  yel: "#d7c07a",
  red: "#d87878",
  grn: "#8fbf87",
  blu: "#7a9ed8",
};

function TUIFrame({ state }) {
  const s = state;
  const box = (w) => "─".repeat(w);
  const W = 94;

  const Line = ({ children, color }) => (
    <div style={{ whiteSpace: "pre", color: color || tuiColors.ink, lineHeight: 1.35 }}>{children}</div>
  );

  return (
    <div style={{ width: "100%", height: "100%", background: tuiColors.bg, display: "flex", flexDirection: "column", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11.5 }}>
      {/* terminal chrome */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: tuiColors.chrome, borderBottom: "1px solid #222" }}>
        <span style={{ width: 11, height: 11, borderRadius: 6, background: "#ff5f57" }} />
        <span style={{ width: 11, height: 11, borderRadius: 6, background: "#ffbd2e" }} />
        <span style={{ width: 11, height: 11, borderRadius: 6, background: "#28ca42" }} />
        <span style={{ flex: 1, textAlign: "center", color: tuiColors.dim, fontSize: 11 }}>
          ~/code/repo-quest-log — quest-log --watch
        </span>
      </div>

      <div style={{ flex: 1, padding: "14px 18px", overflow: "hidden" }}>
        <Line color={tuiColors.dim}>{`┌─ repo-quest-log ${box(W - 30)} ${s.branch} ─┐`}</Line>
        <Line>{`│ `}<span style={{ color: tuiColors.accent }}>◆ Mission</span>{`   ${s.mission.slice(0, 70)}...`}</Line>
        <Line>{`│ `}<span style={{ color: tuiColors.yel }}>◆ Quest</span>{`     ${s.activeQuest.title}  `}<span style={{ color: tuiColors.dim }}>{`[${s.activeQuest.progress.done}/${s.activeQuest.progress.total}]`}</span></Line>
        <Line color={tuiColors.dim}>{`└${box(W)}┘`}</Line>
        <Line>{" "}</Line>

        <Line color={tuiColors.yel}>{`┌─ ⏱  resume ${box(W - 13)}┐`}</Line>
        <Line>{`│ `}<span style={{ color: tuiColors.ink }}>{s.resumeNote.task}</span></Line>
        <Line>{`│ `}<span style={{ color: tuiColors.dim, fontStyle: "italic" }}>{`"${s.resumeNote.thought}"`}</span></Line>
        <Line>{`│ `}<span style={{ color: tuiColors.dim }}>{`↳ ${s.resumeNote.lastTouched} · idle ${s.resumeNote.since}`}</span></Line>
        <Line color={tuiColors.yel}>{`└${box(W)}┘`}</Line>
        <Line>{" "}</Line>

        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Line color={tuiColors.accent}>{`┌─ NOW ───────────────────────────┐`}</Line>
            {s.now.map((t, i) => (
              <Line key={t.id}>
                <span style={{ color: tuiColors.dim }}>{`│ ${String(i + 1).padStart(2, "0")} `}</span>
                <span style={{ color: t.agent === "claude" ? "#e6a888" : t.agent === "codex" ? "#8fd0a9" : tuiColors.dim }}>{`[${t.agent[0].toUpperCase()}] `}</span>
                <span>{t.text.slice(0, 22)}</span>
              </Line>
            ))}
            <Line color={tuiColors.accent}>{`└─────────────────────────────────┘`}</Line>
          </div>
          <div style={{ flex: 1 }}>
            <Line color={tuiColors.blu}>{`┌─ NEXT ──────────────────────────┐`}</Line>
            {s.next.slice(0, 4).map((t, i) => (
              <Line key={t.id}>
                <span style={{ color: tuiColors.dim }}>{`│ ${String(i + 1).padStart(2, "0")} `}</span>
                <span style={{ color: tuiColors.ink }}>{t.text.slice(0, 27)}</span>
              </Line>
            ))}
            <Line color={tuiColors.blu}>{`└─────────────────────────────────┘`}</Line>
          </div>
        </div>
        <Line>{" "}</Line>

        <Line color={tuiColors.red}>{`┌─ BLOCKED ${box(W - 11)}┐`}</Line>
        {s.blocked.map((b, i) => (
          <React.Fragment key={b.id}>
            <Line>{`│ `}<span style={{ color: tuiColors.red }}>{`✕ `}</span><span>{b.text}</span></Line>
            <Line>{`│   `}<span style={{ color: tuiColors.dim }}>{`↳ ${b.reason} · ${b.since} ago`}</span></Line>
          </React.Fragment>
        ))}
        <Line color={tuiColors.red}>{`└${box(W)}┘`}</Line>
        <Line>{" "}</Line>

        <Line color={tuiColors.mag}>{`┌─ AGENTS ${box(W - 10)}┐`}</Line>
        {s.agents.map((a) => (
          <Line key={a.id}>
            <span style={{ color: tuiColors.dim }}>{`│ `}</span>
            <span style={{ color: a.id === "claude" ? "#e6a888" : a.id === "codex" ? "#8fd0a9" : "#a8c3f0" }}>{`[${a.name.padEnd(7)}]`}</span>
            <span style={{ color: tuiColors.dim }}>{` ${a.status.padEnd(8)} `}</span>
            <span>{a.objective.slice(0, 54)}</span>
          </Line>
        ))}
        <Line color={tuiColors.mag}>{`└${box(W)}┘`}</Line>
        <Line>{" "}</Line>

        <Line color={tuiColors.dim}>
          <span style={{ color: tuiColors.grn }}>●</span> watching {s.scannedFiles.length} files · last scan {s.lastScan}   <span style={{ color: tuiColors.dim }}>[q]uit [r]escan [f]ocus [1-3] panel</span>
        </Line>
      </div>
    </div>
  );
}

Object.assign(window, { TUIFrame });
