// HUD — the hero desktop view. Spacesuit-inspired: dark, calm, floating tiles
// on a subtle grid, positioned freely (CSS grid areas under the hood so it
// looks hand-placed without the chaos of absolute positioning).

const hudPalette = {
  bg: "#0b0d10",
  bgGrid: "rgba(120,140,180,0.035)",
  tile: "rgba(18,22,28,0.78)",
  tileBorder: "rgba(100,120,150,0.12)",
  tileBorderHot: "rgba(140,170,220,0.28)",
  ink: "#e6ecf2",
  muted: "rgba(220,230,245,0.48)",
  dim: "rgba(220,230,245,0.32)",
  faint: "rgba(220,230,245,0.18)",
  accent: "#8ab4ff",     // calm cyan-blue
  accentSoft: "rgba(138,180,255,0.14)",
  warn: "#e9b973",
  warnSoft: "rgba(233,185,115,0.12)",
  ok: "#8ad6a8",
  mono: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, monospace",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// Density presets — tweakable
const hudDensities = {
  spacious: { tileGap: 18, tilePad: 22, rowGap: 10, fontBase: 14 },
  compact:  { tileGap: 10, tilePad: 14, rowGap: 6,  fontBase: 13 },
};

function HUDTile({ title, meta, action, children, span, accent, hidden, density = "spacious" }) {
  if (hidden) return null;
  const d = hudDensities[density];
  return (
    <section style={{
      gridArea: span,
      background: hudPalette.tile,
      border: `1px solid ${accent ? hudPalette.tileBorderHot : hudPalette.tileBorder}`,
      borderRadius: 10,
      padding: d.tilePad,
      display: "flex",
      flexDirection: "column",
      gap: d.rowGap + 4,
      minHeight: 0,
      backdropFilter: "blur(8px)",
      boxShadow: "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 40px -20px rgba(0,0,0,0.6)",
    }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontFamily: hudPalette.mono, fontSize: 11, fontWeight: 500,
            color: hudPalette.muted, letterSpacing: 1.4, textTransform: "uppercase",
          }}>{title}</h3>
          {meta && <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.faint, letterSpacing: 0.4 }}>{meta}</span>}
        </div>
        {action}
      </header>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: d.rowGap }}>
        {children}
      </div>
    </section>
  );
}

function Dot({ color, size = 6 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: size, background: color, flexShrink: 0 }} />;
}

function AgentBadge({ agent }) {
  const map = {
    claude:  { label: "C", bg: "rgba(217,119,87,0.18)",  ink: "#e6a888" },
    codex:   { label: "X", bg: "rgba(118,186,143,0.18)", ink: "#8fd0a9" },
    gemini:  { label: "G", bg: "rgba(138,180,255,0.18)", ink: "#a8c3f0" },
    "—":     { label: "·", bg: "rgba(180,190,210,0.10)", ink: hudPalette.dim },
  };
  const a = map[agent] || map["—"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18, borderRadius: 4, background: a.bg, color: a.ink,
      fontFamily: hudPalette.mono, fontSize: 10, fontWeight: 600, flexShrink: 0,
    }}>{a.label}</span>
  );
}

function TaskRow({ task, index, emphasis, density = "spacious" }) {
  const d = hudDensities[density];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "16px 18px 1fr auto",
      alignItems: "center",
      gap: 10,
      padding: density === "compact" ? "4px 0" : "6px 0",
      borderBottom: `1px solid ${hudPalette.faint}`,
      color: hudPalette.ink,
      fontSize: d.fontBase,
      lineHeight: 1.35,
    }}>
      <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.dim, textAlign: "right" }}>{index}</span>
      <AgentBadge agent={task.agent} />
      <span style={{
        fontWeight: emphasis ? 500 : 400,
        color: emphasis ? hudPalette.ink : "rgba(230,236,242,0.82)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{task.text}</span>
      <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.dim, letterSpacing: 0.2 }}>
        {task.doc}
      </span>
    </div>
  );
}

function TopBar({ state }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 18, padding: "14px 24px",
      borderBottom: `1px solid ${hudPalette.tileBorder}`,
      fontFamily: hudPalette.sans, color: hudPalette.ink, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke={hudPalette.accent} strokeWidth="1.3" />
          <path d="M5.5 9L8 11.5L12.5 6.5" stroke={hudPalette.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontFamily: hudPalette.mono, fontSize: 12, letterSpacing: 0.4, color: hudPalette.muted }}>repo quest log</span>
      </div>
      <span style={{ width: 1, height: 16, background: hudPalette.tileBorder }} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, fontFamily: hudPalette.mono, fontSize: 13 }}>
        <span style={{ color: hudPalette.ink }}>{state.name}</span>
        <span style={{ color: hudPalette.dim }}>/</span>
        <span style={{ color: hudPalette.accent }}>{state.branch}</span>
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: hudPalette.mono, fontSize: 11, color: hudPalette.muted }}>
        <Dot color={hudPalette.ok} />
        <span>watching {state.scannedFiles.length} files</span>
        <span style={{ color: hudPalette.dim }}>· scanned {state.lastScan}</span>
      </div>
    </header>
  );
}

function MissionBanner({ state, density }) {
  const d = hudDensities[density];
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr auto",
      alignItems: "center",
      gap: 24,
      padding: `${d.tilePad}px ${d.tilePad + 4}px`,
      background: `linear-gradient(90deg, ${hudPalette.accentSoft}, transparent 70%)`,
      border: `1px solid ${hudPalette.tileBorder}`,
      borderRadius: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.muted, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
          Mission
        </div>
        <div style={{ fontFamily: hudPalette.sans, fontSize: 17, lineHeight: 1.35, color: hudPalette.ink, fontWeight: 500, textWrap: "pretty" }}>
          {state.mission}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.muted, letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6 }}>
          Active Quest
        </div>
        <div style={{ fontFamily: hudPalette.sans, fontSize: 14, color: hudPalette.ink, fontWeight: 500 }}>
          {state.activeQuest.title}
        </div>
        <div style={{ fontFamily: hudPalette.mono, fontSize: 11, color: hudPalette.muted, marginTop: 4 }}>
          {state.activeQuest.progress.done}/{state.activeQuest.progress.total} complete · {state.activeQuest.doc}:{state.activeQuest.line}
        </div>
      </div>
    </div>
  );
}

function SessionAnchor({ state, density }) {
  const r = state.resumeNote;
  const d = hudDensities[density];
  return (
    <section style={{
      background: `linear-gradient(135deg, ${hudPalette.warnSoft}, transparent 80%)`,
      border: `1px solid rgba(233,185,115,0.28)`,
      borderRadius: 10,
      padding: d.tilePad,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="5.5" stroke={hudPalette.warn} strokeWidth="1.2" />
          <path d="M6.5 3.5V6.5L8.5 8" stroke={hudPalette.warn} strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.warn, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 500 }}>
          Resume where you left off
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.dim }}>idle {r.since}</span>
      </div>
      <div style={{ fontFamily: hudPalette.sans, fontSize: 18, color: hudPalette.ink, fontWeight: 500, lineHeight: 1.3, textWrap: "pretty" }}>
        {r.task}
      </div>
      <div style={{ fontFamily: hudPalette.mono, fontSize: 12, color: hudPalette.muted, fontStyle: "italic", lineHeight: 1.4 }}>
        &ldquo;{r.thought}&rdquo;
      </div>
      <div style={{ display: "flex", gap: 16, fontFamily: hudPalette.mono, fontSize: 11, color: hudPalette.dim, marginTop: 2 }}>
        <span>↳ {r.lastTouched}</span>
        <span>· {r.doc}</span>
      </div>
    </section>
  );
}

function NowTile({ state, density }) {
  return (
    <HUDTile
      title="Now"
      meta={`max 3 · ${state.now.length} active`}
      accent
      density={density}
      action={
        <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.accent, letterSpacing: 0.4 }}>
          ⌘1
        </span>
      }
    >
      {state.now.map((t, i) => (
        <TaskRow key={t.id} task={t} index={(i + 1).toString().padStart(2, "0")} emphasis density={density} />
      ))}
    </HUDTile>
  );
}

function NextTile({ state, density }) {
  return (
    <HUDTile title="Next" meta={`queue · ${state.next.length}`} density={density}>
      {state.next.map((t, i) => (
        <TaskRow key={t.id} task={t} index={(i + 1).toString().padStart(2, "0")} density={density} />
      ))}
    </HUDTile>
  );
}

function BlockedTile({ state, density, hidden }) {
  const d = hudDensities[density];
  return (
    <HUDTile title="Blocked" meta={`${state.blocked.length} waiting`} density={density} hidden={hidden}>
      {state.blocked.map((b, i) => (
        <div key={b.id} style={{
          padding: density === "compact" ? "6px 0" : "8px 0",
          borderBottom: `1px solid ${hudPalette.faint}`,
          display: "flex", flexDirection: "column", gap: 3,
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.dim }}>
              {(i + 1).toString().padStart(2, "0")}
            </span>
            <span style={{ fontSize: d.fontBase, color: hudPalette.ink, fontWeight: 500, lineHeight: 1.3 }}>
              {b.text}
            </span>
          </div>
          <div style={{ fontFamily: hudPalette.mono, fontSize: 11, color: hudPalette.muted, paddingLeft: 18 }}>
            ↳ {b.reason} · {b.since} ago
          </div>
        </div>
      ))}
    </HUDTile>
  );
}

function AgentsTile({ state, density, hidden }) {
  const d = hudDensities[density];
  const statusColor = { active: hudPalette.accent, working: hudPalette.ok, idle: hudPalette.dim };
  return (
    <HUDTile title="Agents" meta={`${state.agents.length} registered`} density={density} hidden={hidden}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: d.rowGap + 2 }}>
        {state.agents.map((a) => (
          <div key={a.id} style={{
            padding: density === "compact" ? 10 : 12,
            background: "rgba(255,255,255,0.02)",
            border: `1px solid ${hudPalette.faint}`,
            borderRadius: 6,
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <AgentBadge agent={a.id} />
              <span style={{ fontSize: d.fontBase, fontWeight: 600, color: hudPalette.ink }}>{a.name}</span>
              <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: hudPalette.dim }}>· {a.role}</span>
              <span style={{ flex: 1 }} />
              <Dot color={statusColor[a.status]} />
              <span style={{ fontFamily: hudPalette.mono, fontSize: 10, color: statusColor[a.status], letterSpacing: 0.4 }}>
                {a.status}
              </span>
            </div>
            <div style={{ fontSize: 12.5, color: "rgba(230,236,242,0.78)", lineHeight: 1.35 }}>
              {a.objective}
            </div>
            <div style={{ display: "flex", gap: 10, fontFamily: hudPalette.mono, fontSize: 10.5, color: hudPalette.muted, flexWrap: "wrap" }}>
              <span>↳ {a.file}</span>
              <span>· area: {a.area}</span>
            </div>
          </div>
        ))}
      </div>
    </HUDTile>
  );
}

function ChangesTile({ state, density }) {
  const d = hudDensities[density];
  return (
    <HUDTile title="Recent changes" meta="file watcher" density={density}>
      {state.recentChanges.map((c) => (
        <div key={c.file} style={{
          display: "grid", gridTemplateColumns: "1fr auto auto",
          alignItems: "center", gap: 10,
          padding: density === "compact" ? "3px 0" : "4px 0",
          fontFamily: hudPalette.mono, fontSize: 11.5, color: hudPalette.ink,
        }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.file}</span>
          <span style={{ color: hudPalette.ok }}>{c.diff}</span>
          <span style={{ color: hudPalette.dim, minWidth: 34, textAlign: "right" }}>{c.at}</span>
        </div>
      ))}
    </HUDTile>
  );
}

// Layout: desktop HUD
function DesktopHUD({ state, tweaks }) {
  const { density, showAgents, showBlocked, showChanges } = tweaks;
  const d = hudDensities[density];

  // CSS grid template — adjusts when tiles are hidden
  const template = {
    areas: [
      '"mission  mission  mission"',
      '"resume   resume   agents"',
      '"now      next     agents"',
      '"blocked  changes  agents"',
    ],
    cols: "1.15fr 1.15fr 1fr",
    rows: "auto auto 1fr auto",
  };

  return (
    <div style={{
      width: "100%", height: "100%",
      background: hudPalette.bg,
      backgroundImage: `
        radial-gradient(circle at 20% 10%, rgba(138,180,255,0.06), transparent 40%),
        radial-gradient(circle at 80% 90%, rgba(217,119,87,0.04), transparent 40%),
        linear-gradient(${hudPalette.bgGrid} 1px, transparent 1px),
        linear-gradient(90deg, ${hudPalette.bgGrid} 1px, transparent 1px)
      `,
      backgroundSize: "auto, auto, 32px 32px, 32px 32px",
      color: hudPalette.ink,
      fontFamily: hudPalette.sans,
      display: "flex", flexDirection: "column",
      overflow: "hidden",
    }}>
      <TopBar state={state} />
      <main style={{
        flex: 1, minHeight: 0,
        padding: d.tilePad,
        display: "grid",
        gridTemplateAreas: template.areas.join(" "),
        gridTemplateColumns: template.cols,
        gridTemplateRows: template.rows,
        gap: d.tileGap,
      }}>
        <div style={{ gridArea: "mission" }}>
          <MissionBanner state={state} density={density} />
        </div>
        <div style={{ gridArea: "resume" }}>
          <SessionAnchor state={state} density={density} />
        </div>
        <NowTile state={state} density={density} />
        <NextTile state={state} density={density} />
        <BlockedTile state={state} density={density} hidden={!showBlocked} />
        <ChangesTile state={state} density={density} />
        <AgentsTile state={state} density={density} hidden={!showAgents} />
      </main>
    </div>
  );
}

Object.assign(window, { DesktopHUD, hudPalette, hudDensities });
