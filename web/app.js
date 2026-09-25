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
          <p>Start with the syntax, get comfortable with ownership and the borrow checker, then build, test, document and publish a real library. Each lesson has runnable examples, exercises with solutions and a short quiz.</p>
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
        <div><h3>Run everything</h3><p>Complete programs have a Run in Playground button, so you can edit and run them in your browser. Install Rust locally when you are ready (lesson 01).</p></div>
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
    wireCode();
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

  function wireCode() {
    main.querySelectorAll("figure.code").forEach((fig) => {
      const code = fig.querySelector("pre code").textContent;
      const play = fig.querySelector("[data-play]");
      if (play) play.href = PLAYGROUND + encodeURIComponent(code);
      const copy = fig.querySelector("[data-copy]");
      copy.addEventListener("click", () => {
        const text = code.split("\n").map((line) => line.replace(/^\$ /, "")).join("\n");
        const done = () => { copy.textContent = "Copied"; setTimeout(() => (copy.textContent = "Copy"), 1400); };
        const fallback = () => {
          const range = document.createRange();
          range.selectNodeContents(fig.querySelector("pre code"));
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
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
