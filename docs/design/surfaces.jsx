// VS Code side panel + menu-bar widget

const vscColors = {
  bg: "#1e1e1e",
  panel: "#252526",
  chrome: "#323233",
  border: "#1a1a1a",
  ink: "#cccccc",
  muted: "#858585",
  dim: "#6a6a6a",
  accent: "#4ec9b0",
  blue: "#569cd6",
  yel: "#dcdcaa",
  red: "#f48771",
};

function VSCodePanel({ state }) {
  const Section = ({ icon, label, count, children, open = true, accent }) => (
    <div style={{ borderBottom: `1px solid ${vscColors.border}` }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
        fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, color: vscColors.ink,
        background: vscColors.chrome, cursor: "pointer",
      }}>
        <span style={{ fontSize: 9, color: vscColors.muted, transform: open ? "rotate(90deg)" : "none", display: "inline-block", width: 10 }}>▶</span>
        <span>{label}</span>
        {count !== undefined && <span style={{ marginLeft: 6, background: accent || "#3f3f41", color: "#fff", fontSize: 10, padding: "0 6px", borderRadius: 8, fontWeight: 600, letterSpacing: 0 }}>{count}</span>}
      </div>
      {open && <div style={{ padding: "4px 0" }}>{children}</div>}
    </div>
  );

  const Row = ({ icon, text, sub, color }) => (
    <div style={{ padding: "2px 24px", display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: vscColors.ink, lineHeight: 1.5 }}>
      <span style={{ color: color || vscColors.muted, fontSize: 11, width: 12 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</span>
      {sub && <span style={{ color: vscColors.dim, fontSize: 11, marginLeft: "auto" }}>{sub}</span>}
    </div>
  );

  return (
    <div style={{ width: "100%", height: "100%", background: vscColors.bg, display: "flex", flexDirection: "column", fontFamily: "'Segoe UI', -apple-system, sans-serif", fontSize: 13, color: vscColors.ink, overflow: "hidden" }}>
      {/* VSCode activity bar header */}
      <div style={{ height: 35, background: vscColors.chrome, display: "flex", alignItems: "center", padding: "0 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700, color: vscColors.ink, borderBottom: `1px solid ${vscColors.border}` }}>
        <span>Repo Quest Log</span>
        <span style={{ marginLeft: "auto", color: vscColors.muted, fontSize: 11, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>{state.branch}</span>
      </div>

      {/* Resume banner */}
      <div style={{ padding: "10px 12px", borderBottom: `1px solid ${vscColors.border}`, background: "rgba(220,220,170,0.06)" }}>
        <div style={{ fontSize: 10, color: vscColors.yel, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
          ⏱ Resume
        </div>
        <div style={{ fontSize: 13, color: vscColors.ink, marginBottom: 3, lineHeight: 1.3 }}>{state.resumeNote.task}</div>
        <div style={{ fontSize: 11, color: vscColors.muted, fontStyle: "italic" }}>&ldquo;{state.resumeNote.thought}&rdquo;</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <Section label="Now" count={state.now.length} accent="#0e639c">
          {state.now.map((t) => (
            <Row key={t.id} icon="◆" color={vscColors.accent} text={t.text} sub={`[${t.agent[0].toUpperCase()}]`} />
          ))}
        </Section>

        <Section label="Next" count={state.next.length}>
          {state.next.slice(0, 4).map((t) => (
            <Row key={t.id} icon="○" text={t.text} sub={`[${t.agent[0].toUpperCase()}]`} />
          ))}
        </Section>

        <Section label="Blocked" count={state.blocked.length} accent="#a1260d">
          {state.blocked.map((b) => (
            <Row key={b.id} icon="✕" color={vscColors.red} text={b.text} sub={b.since} />
          ))}
        </Section>

        <Section label="Agents" count={state.agents.length}>
          {state.agents.map((a) => (
            <div key={a.id} style={{ padding: "4px 24px", fontSize: 13, lineHeight: 1.4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: a.status === "working" ? vscColors.accent : a.status === "active" ? vscColors.blue : vscColors.dim }}>●</span>
                <span style={{ color: vscColors.yel, fontWeight: 600 }}>{a.name}</span>
                <span style={{ color: vscColors.dim, fontSize: 11 }}>{a.file}</span>
              </div>
              <div style={{ color: vscColors.muted, fontSize: 12, marginLeft: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.objective}
              </div>
            </div>
          ))}
        </Section>

        <Section label="Recent changes" count={state.recentChanges.length}>
          {state.recentChanges.map((c) => (
            <Row key={c.file} icon="M" color={vscColors.yel} text={c.file} sub={c.at} />
          ))}
        </Section>
      </div>

      {/* status bar */}
      <div style={{ height: 22, background: "#007acc", color: "#fff", display: "flex", alignItems: "center", padding: "0 8px", fontSize: 12, gap: 12 }}>
        <span>⎇ {state.branch}</span>
        <span>◉ watching {state.scannedFiles.length}</span>
        <span style={{ marginLeft: "auto", opacity: 0.85 }}>Quest Log · {state.lastScan}</span>
      </div>
    </div>
  );
}

function MenuBarWidget({ state }) {
  return (
    <div style={{ width: "100%", height: "100%", background: "#1c1e22", color: "#e6ecf2", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", padding: 14, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
      {/* mac menubar chrome */}
      <div style={{ position: "absolute", top: -22, left: 20, width: 14, height: 14, background: "#1c1e22", transform: "rotate(45deg)", borderTop: "1px solid rgba(255,255,255,0.08)", borderLeft: "1px solid rgba(255,255,255,0.08)" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
          <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="#8ab4ff" strokeWidth="1.3" />
          <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#8ab4ff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 12, color: "rgba(230,236,242,0.7)", fontFamily: "'JetBrains Mono', monospace" }}>
          {state.name}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(138,214,168,0.9)", fontFamily: "'JetBrains Mono', monospace" }}>● live</span>
      </div>

      <div style={{ background: "rgba(233,185,115,0.08)", border: "1px solid rgba(233,185,115,0.22)", borderRadius: 7, padding: "8px 10px" }}>
        <div style={{ fontSize: 9, color: "#e9b973", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 3 }}>
          Resume
        </div>
        <div style={{ fontSize: 12.5, color: "#e6ecf2", lineHeight: 1.3, fontWeight: 500 }}>
          {state.resumeNote.task}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, color: "#8ab4ff", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 4 }}>Now</div>
        {state.now.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "3px 0", fontSize: 12, color: "#e6ecf2", borderBottom: i < state.now.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(230,236,242,0.4)", width: 12 }}>0{i + 1}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{t.text}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: t.agent === "claude" ? "#e6a888" : t.agent === "codex" ? "#8fd0a9" : "rgba(230,236,242,0.4)", textTransform: "uppercase" }}>{t.agent[0]}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontSize: 9, color: "rgba(230,236,242,0.5)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 600, marginBottom: 4 }}>Agents</div>
        <div style={{ display: "flex", gap: 6 }}>
          {state.agents.map((a) => (
            <div key={a.id} style={{ flex: 1, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 5, padding: "6px 8px", fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 3, background: a.status === "working" ? "#8ad6a8" : a.status === "active" ? "#8ab4ff" : "rgba(230,236,242,0.3)" }} />
                <span style={{ color: "#e6ecf2", fontWeight: 600, fontSize: 11 }}>{a.name}</span>
              </div>
              <div style={{ color: "rgba(230,236,242,0.5)", fontSize: 10, marginTop: 2, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.3 }}>{a.status}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "auto", display: "flex", gap: 6, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: 10, color: "rgba(230,236,242,0.45)", fontFamily: "'JetBrains Mono', monospace" }}>
        <span>⌘⇧Q open HUD</span>
        <span style={{ marginLeft: "auto" }}>scan {state.lastScan}</span>
      </div>
    </div>
  );
}

Object.assign(window, { VSCodePanel, MenuBarWidget });
