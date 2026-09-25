(function () {
  "use strict";

  const course = JSON.parse(document.getElementById("course-data").textContent);
  const lessons = course.lessons;
  const byId = new Map(lessons.map((l) => [l.id, l]));
  const main = document.getElementById("main");
  const rail = document.getElementById("rail");
  const scrim = document.getElementById("scrim");
  const menuBtn = document.getElementById("menu-btn");

  // ---------------------------------------------------------- progress (per browser)

  const STORE_KEY = "learnrust.progress.v1";
  let progress = { done: [], last: null };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (saved && Array.isArray(saved.done)) progress = { done: saved.done, last: saved.last || null };
  } catch (_) { /* storage unavailable: progress lasts for this visit only */ }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (_) { /* ignore */ }
  }
  const isDone = (id) => progress.done.includes(id);
  function setDone(id, done) {
    progress.done = progress.done.filter((x) => x !== id);
    if (done) progress.done.push(id);
    save();
    renderRail();
  }
  const doneCount = () => lessons.filter((l) => isDone(l.id)).length;

  // ---------------------------------------------------------- helpers

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pad = (n) => String(n).padStart(2, "0");

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  function nextUnfinished() {
    return lessons.find((l) => !isDone(l.id)) || lessons[lessons.length - 1];
  }

  // ---------------------------------------------------------- rail

  function cargoBar(done, total) {
    const width = 18;
    const filled = Math.round((done / total) * width);
    const bar = "=".repeat(Math.max(0, filled - 1)) + (filled > 0 && filled < width ? ">" : filled === width ? "=" : "");
    return `[${bar.padEnd(width, " ")}]`;
  }

  function renderRail(currentId) {
    if (currentId !== undefined) renderRail.current = currentId;
    const current = renderRail.current;
    const done = doneCount();
    const total = lessons.length;
    const status = document.getElementById("build-status");
    status.innerHTML =
      done === total
        ? `<span class="k">  Finished</span> course in ${total} lessons\n<span class="dim">  Ready to publish your crate</span>`
        : `<span class="k">Compiling</span> learnrust v0.${done}.0\n<span class="bar">${cargoBar(done, total)}</span> <span class="dim">${done}/${total}</span>`;
    document.getElementById("topbar-progress").textContent = `${done}/${total} done`;

    document.getElementById("rail-modules").innerHTML = course.modules
      .map((m) => {
        const ls = m.lessons.map((id) => byId.get(id));
        const d = ls.filter((l) => isDone(l.id)).length;
        return `<section class="module">
          <div class="module-head"><span class="module-name">${esc(m.name)}</span><span class="module-count">${d}/${ls.length}</span></div>
          ${ls
            .map(
              (l) => `<a class="lesson-link${isDone(l.id) ? " is-done" : ""}" href="#${l.id}"${l.id === current ? ' aria-current="page"' : ""}>
                <span class="lesson-num">${pad(l.n)}</span><span>${esc(l.title)}</span><span class="tick" aria-label="${isDone(l.id) ? "Completed" : "Not completed"}"></span></a>`
            )
            .join("")}
        </section>`;
      })
      .join("");
  }

  function openRail(open) {
    rail.classList.toggle("is-open", open);
    scrim.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", () => openRail(!rail.classList.contains("is-open")));
  scrim.addEventListener("click", () => openRail(false));
  rail.addEventListener("click", (e) => { if (e.target.closest("a")) openRail(false); });

  // ---------------------------------------------------------- home

  function renderHome() {
    const done = doneCount();
    const next = nextUnfinished();
    const started = done > 0 || progress.last;
    const resume = progress.last && byId.get(progress.last) && !isDone(progress.last) ? byId.get(progress.last) : next;
    document.title = "Learn Rust";

    main.innerHTML = `<div class="home">
      <section class="hero">
        <div>
          <p class="eyebrow">A self-paced Rust course · ${lessons.length} lessons</p>
          <h1>From <code>fn main()</code> to your own crate on crates.io</h1>
          <p>Start with the syntax, get comfortable with ownership and the borrow checker, then build, test, document and publish a real library. Each lesson has examples you can edit and run, exercises with solutions and a short quiz.</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#${resume.id}">${started ? `Continue: ${pad(resume.n)} ${esc(resume.title)}` : "Start lesson 01"} →</a>
            ${started ? `<span class="module-count">${done} of ${lessons.length} lessons complete</span>` : ""}
          </div>
        </div>
        <div class="terminal" aria-label="Where the course ends up">
          <div class="terminal-head" aria-hidden="true"><i></i><i></i><i></i></div>
          <pre><span class="tok-prompt">$ </span><span class="tok-cmd">cargo new --lib wordstat</span>
<span class="tok-ok">    Creating</span> library \`wordstat\` package
<span class="tok-prompt">$ </span><span class="tok-cmd">cargo test</span>
<span class="tok-ok">   Compiling</span> wordstat v0.1.0
test result: <span class="tok-ok">ok</span>. 12 passed; 0 failed
<span class="tok-prompt">$ </span><span class="tok-cmd">cargo publish</span>
<span class="tok-ok">   Packaging</span> wordstat v0.1.0
<span class="tok-ok">   Uploading</span> wordstat v0.1.0
<span class="tok-ok">   Published</span> wordstat v0.1.0 at registry \`crates-io\`</pre>
        </div>
      </section>

      <section class="roadmap">
        <h2>The route</h2>
        <p>Six modules, in order. Each one leans on the ones before it, so work through them top to bottom. Your progress is saved in this browser.</p>
        <div class="modules">
          ${course.modules
            .map((m, i) => {
              const ls = m.lessons.map((id) => byId.get(id));
              const d = ls.filter((l) => isDone(l.id)).length;
              const mins = ls.reduce((s, l) => s + (Number(l.minutes) || 0), 0);
              return `<article class="module-card">
                <header>
                  <span class="step"><span>Module ${i + 1}</span><span>${d}/${ls.length} · ~${Math.round(mins / 5) * 5} min</span></span>
                  <h3>${esc(m.name)}</h3>
                  <div class="gauge" aria-hidden="true"><span style="width:${(d / ls.length) * 100}%"></span></div>
                </header>
                <ol>${ls
                  .map(
                    (l) => `<li><a href="#${l.id}" class="${isDone(l.id) ? "is-done" : ""}"><span><span class="lesson-num">${pad(l.n)}</span> ${esc(l.title)}</span><span class="tick" aria-label="${isDone(l.id) ? "Completed" : "Not completed"}"></span></a></li>`
                  )
                  .join("")}</ol>
              </article>`;
            })
            .join("")}
        </div>
      </section>

      <section class="goal">
        <div><h3>Edit and run everything</h3><p>Every Rust example is editable. Change it and press Run (or Ctrl+Enter) to compile it on the Rust Playground and see the output right here. Your edits are saved in this browser.</p></div>
        <div><h3>Type the exercises</h3><p>Try each exercise before opening the solution. Getting a compiler error and fixing it is how Rust sinks in.</p></div>
        <div><h3>Finish with a crate</h3><p>The last module builds <code>wordstat</code>, a small library with tests and docs, and shows you how to publish it or keep it private.</p></div>
      </section>
    </div>`;
    renderRail(null);
  }

  // ---------------------------------------------------------- lesson

  function renderLesson(l) {
    const idx = lessons.indexOf(l);
    const prev = lessons[idx - 1];
    const next = lessons[idx + 1];
    const modIndex = course.modules.findIndex((m) => m.name === l.module);
    progress.last = l.id;
    save();
    document.title = `${l.title} · Learn Rust`;

    main.innerHTML = `<article class="lesson">
      <header class="lesson-head">
        <p class="crumbs"><b>Lesson ${pad(l.n)}</b><span>Module ${modIndex + 1}: ${esc(l.module)}</span><span>~${esc(l.minutes)} min</span></p>
        <h1>${esc(l.title)}</h1>
        <p class="lesson-summary">${esc(l.summary)}</p>
        ${l.toc.length > 1 ? `<ul class="toc" aria-label="In this lesson">${l.toc.map((t) => `<li><button type="button" data-jump="${esc(t.id)}">${esc(t.text)}</button></li>`).join("")}</ul>` : ""}
      </header>
      <div class="prose">${l.html}</div>
      <footer class="lesson-foot">
        <div class="complete-row" id="complete-row"></div>
        <nav class="pager" aria-label="Lesson navigation">
          ${prev ? `<a class="prev" href="#${prev.id}"><small>← Previous · ${pad(prev.n)}</small><span>${esc(prev.title)}</span></a>` : ""}
          ${next ? `<a class="next" href="#${next.id}"><small>Next · ${pad(next.n)} →</small><span>${esc(next.title)}</span></a>` : `<a class="next" href="#home"><small>Course complete →</small><span>Back to the overview</span></a>`}
        </nav>
        <p class="kbd-hint">Tip: use <kbd>←</kbd> and <kbd>→</kbd> to move between lessons.</p>
      </footer>
    </article>`;

    renderCompleteRow(l);
    wireCode(l);
    wireQuizzes();
    renderRail(l.id);
  }

  function renderCompleteRow(l) {
    const row = document.getElementById("complete-row");
    if (!row) return;
    const done = isDone(l.id);
    row.innerHTML = done
      ? `<button type="button" class="btn btn-done" id="complete-btn" aria-pressed="true">✓ Completed</button><p>Nice work. Click again to mark it unfinished.</p>`
      : `<button type="button" class="btn btn-primary" id="complete-btn" aria-pressed="false">Mark lesson complete</button><p>Done the exercises and the quiz? Tick it off.</p>`;
    document.getElementById("complete-btn").addEventListener("click", () => {
      setDone(l.id, !isDone(l.id));
      renderCompleteRow(l);
      if (isDone(l.id)) toast(`Lesson ${pad(l.n)} complete · ${doneCount()}/${lessons.length}`);
    });
  }

  // ---------------------------------------------------------- code blocks

  const PLAYGROUND = "https://play.rust-lang.org/?version=stable&mode=debug&edition=2024&code=";
  const PLAY_API = "https://play.rust-lang.org";
  const draftKey = (lessonId, block) => `learnrust.draft.${lessonId}.${block}`;

  function loadDraft(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }
  function saveDraft(key, code, original) {
    try {
      if (code === original) localStorage.removeItem(key);
      else localStorage.setItem(key, code);
    } catch (_) { /* drafts last for this visit only */ }
  }

  function wireCode(lesson) {
    main.querySelectorAll("figure.code").forEach((fig) => {
      const codeEl = fig.querySelector("pre code");
      const original = codeEl.textContent;
      const getCode = fig.hasAttribute("data-editable") ? makeEditor(fig, lesson, original) : () => original;

      const copy = fig.querySelector("[data-copy]");
      copy.addEventListener("click", () => {
        const text = getCode().split("\n").map((line) => line.replace(/^\$ /, "")).join("\n");
        const done = () => { copy.textContent = "Copied"; setTimeout(() => (copy.textContent = "Copy"), 1400); };
        const fallback = () => {
          const ta = fig.querySelector("textarea");
          if (ta) { ta.focus(); ta.select(); }
          else {
            const range = document.createRange();
            range.selectNodeContents(codeEl);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
          }
          copy.textContent = "Selected: press Ctrl+C";
          setTimeout(() => (copy.textContent = "Copy"), 2400);
        };
        try {
          navigator.clipboard.writeText(text).then(done, fallback);
        } catch (_) {
          fallback();
        }
      });
    });
    main.querySelectorAll("[data-jump]").forEach((b) =>
      b.addEventListener("click", () => {
        const target = document.getElementById(b.dataset.jump);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
  }

  // Turns a highlighted Rust block into an editor: a transparent textarea laid over the
  // highlighted <pre>, re-highlighted as you type. Returns a function that reads the current code.
  function makeEditor(fig, lesson, original) {
    const pre = fig.querySelector("pre");
    const codeEl = pre.querySelector("code");
    const key = draftKey(lesson.id, fig.dataset.block);
    const play = fig.querySelector("[data-play]");
    const runBtn = fig.querySelector("[data-run]");

    const wrap = document.createElement("div");
    wrap.className = "editor";
    pre.replaceWith(wrap);
    wrap.appendChild(pre);
    const ta = document.createElement("textarea");
    ta.id = `editor-${lesson.id}-${fig.dataset.block}`;
    ta.setAttribute("wrap", "off");
    ta.setAttribute("spellcheck", "false");
    ta.setAttribute("autocapitalize", "off");
    ta.setAttribute("autocomplete", "off");
    ta.setAttribute("aria-label", "Rust code editor. Press Ctrl+Enter to run, Escape to leave the editor.");
    wrap.appendChild(ta);

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "code-btn";
    reset.textContent = "Reset";
    reset.title = "Undo your edits and restore the original example";
    fig.querySelector(".code-actions").prepend(reset);

    const status = document.createElement("span");
    status.className = "edit-state";
    fig.querySelector("figcaption .code-label").after(status);

    function sync() {
      const code = ta.value;
      // A trailing newline needs a character after it or the <pre> is one line short.
      codeEl.innerHTML = highlight(code.endsWith("\n") ? code + " " : code, "rust");
      play.href = PLAYGROUND + encodeURIComponent(code);
      const edited = code !== original;
      reset.hidden = !edited;
      status.textContent = edited ? "edited" : "";
    }
    ta.value = loadDraft(key) ?? original;
    sync();

    let saveTimer;
    ta.addEventListener("input", () => {
      sync();
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => saveDraft(key, ta.value, original), 300);
    });
    ta.addEventListener("scroll", () => { pre.scrollLeft = ta.scrollLeft; pre.scrollTop = ta.scrollTop; });
    reset.addEventListener("click", () => {
      ta.value = original;
      sync();
      saveDraft(key, original, original);
      const out = fig.querySelector(".run-out");
      if (out) out.remove();
      ta.focus();
    });

    ta.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        runBtn.click();
      } else if (e.key === "Escape") {
        ta.blur();
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        insert("    ");
      } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Keep the current line's indentation, and indent one level after an opening brace.
        const before = ta.value.slice(0, ta.selectionStart);
        const line = before.slice(before.lastIndexOf("\n") + 1);
        let indent = line.match(/^\s*/)[0];
        if (/[{([]\s*$/.test(line)) indent += "    ";
        e.preventDefault();
        insert("\n" + indent);
      }
    });
    function insert(text) {
      // execCommand keeps the browser's undo history working; fall back to direct editing.
      if (!document.execCommand || !document.execCommand("insertText", false, text)) {
        const { selectionStart: s, selectionEnd: end } = ta;
        ta.value = ta.value.slice(0, s) + text + ta.value.slice(end);
        ta.selectionStart = ta.selectionEnd = s + text.length;
        ta.dispatchEvent(new Event("input"));
      }
    }

    runBtn.addEventListener("click", () => runCode(fig, ta.value));
    return () => ta.value;
  }

  // ---------------------------------------------------------- running code

  function kindOf(code) {
    if (/#\[test\]/.test(code)) return "test";
    if (/fn main\s*\(/.test(code)) return "bin";
    return "lib";
  }

  // Strip Cargo's own progress lines so only the compiler's messages remain.
  function cleanStderr(s) {
    return s
      .split("\n")
      .filter((l) => !/^\s*(Compiling playground|Finished `|Running `|Running unittests|Doc-tests playground)/.test(l))
      .join("\n")
      .trim();
  }

  async function execute(code, kind) {
    const res = await fetch(`${PLAY_API}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "stable",
        mode: "debug",
        edition: "2024",
        crateType: kind === "bin" ? "bin" : "lib",
        tests: kind === "test",
        backtrace: false,
        code,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.success !== "boolean") {
      throw new Error(data.error || `The Playground answered with HTTP ${res.status}.`);
    }
    return data;
  }

  async function runCode(fig, code) {
    const runBtn = fig.querySelector("[data-run]");
    let out = fig.querySelector(".run-out");
    if (!out) {
      out = document.createElement("div");
      out.className = "run-out";
      out.setAttribute("aria-live", "polite");
      fig.appendChild(out);
    }
    const kind = kindOf(code);
    out.dataset.state = "busy";
    out.innerHTML = `<p class="run-status">${kind === "lib" ? "Compiling" : "Compiling and running"} on play.rust-lang.org…</p>`;
    runBtn.disabled = true;
    const started = performance.now();

    try {
      const r = await execute(code, kind);
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      const stderr = cleanStderr(r.stderr || "");
      const stdout = (r.stdout || "").replace(/\s+$/, "");
      const compileFailed = !r.success && /^error(\[E\d+\])?:/m.test(stderr) && !/panicked/.test(stderr + stdout);
      let label;
      if (r.success) label = kind === "lib" ? "Compiled without errors" : kind === "test" ? "Tests passed" : "Finished";
      else if (compileFailed) label = "Did not compile";
      else if (kind === "test") label = "Tests failed";
      else label = "Program panicked or exited with an error";
      out.dataset.state = r.success ? "ok" : "bad";

      const parts = [];
      if (stderr) parts.push(`<div class="run-section"><p class="run-head">${compileFailed ? "Compiler" : "Standard error"}</p><pre>${highlight(stderr, "console")}</pre></div>`);
      if (stdout) parts.push(`<div class="run-section"><p class="run-head">Output</p><pre>${highlight(stdout, "text")}</pre></div>`);
      if (!stderr && !stdout && r.success && kind === "bin") parts.push(`<p class="run-note">The program printed nothing.</p>`);
      if (kind === "lib" && r.success) parts.push(`<p class="run-note">This code has no <code>fn main</code>, so there is nothing to run. Add one to try it out.</p>`);
      out.innerHTML = `<p class="run-status">${label}<span>${secs}s</span></p>${parts.join("")}`;
    } catch (err) {
      out.dataset.state = "offline";
      const play = fig.querySelector("[data-play]");
      out.innerHTML = `<p class="run-status">Couldn't reach the Rust Playground from this page</p>
        <p class="run-note">In-page running works on your own hosted copy of the course, with an internet connection. Your code is still here, and you can <a href="${esc(play.href)}" target="_blank" rel="noopener">open it in the Playground ↗</a> instead.</p>`;
    } finally {
      runBtn.disabled = false;
    }
  }

  // ---------------------------------------------------------- quizzes

  function wireQuizzes() {
    main.querySelectorAll("[data-quiz]").forEach((quiz) => {
      const opts = [...quiz.querySelectorAll(".quiz-opt")];
      const explain = quiz.querySelector(".quiz-explain");
      const original = explain.innerHTML;
      opts.forEach((opt) =>
        opt.addEventListener("click", () => {
          const right = opt.dataset.correct === "true";
          opts.forEach((o) => {
            o.disabled = true;
            if (o.dataset.correct === "true" && right) o.classList.add("is-right");
          });
          if (!right) opt.classList.add("is-wrong");
          explain.innerHTML = right
            ? `<span class="verdict ok">Correct.</span> ${original}`
            : `<span class="verdict bad">Not quite.</span> <button type="button" class="quiz-retry">Try again</button>`;
          explain.hidden = false;
          const retry = explain.querySelector(".quiz-retry");
          if (retry) {
            retry.addEventListener("click", () => {
              opts.forEach((o) => { o.disabled = false; o.classList.remove("is-right", "is-wrong"); });
              explain.hidden = true;
              opt.focus();
            });
          }
        })
      );
    });
  }

  // ---------------------------------------------------------- routing

  function route() {
    const id = decodeURIComponent(location.hash.slice(1));
    const lesson = byId.get(id);
    if (lesson) renderLesson(lesson);
    else renderHome();
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }

  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) return;
    if (e.key === "Escape") openRail(false);
    const cur = byId.get(decodeURIComponent(location.hash.slice(1)));
    if (!cur) return;
    const idx = lessons.indexOf(cur);
    if (e.key === "ArrowRight" && lessons[idx + 1]) location.hash = lessons[idx + 1].id;
    if (e.key === "ArrowLeft" && lessons[idx - 1]) location.hash = lessons[idx - 1].id;
  });

  route();
})();
