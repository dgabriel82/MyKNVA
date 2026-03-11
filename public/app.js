const api = async (path, options = {}) => {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Erreur serveur");
  }
  return res.json();
};

const defaultSettings = () => ({
  blockMode: "half-full",
  halfDayPeriod: "pm",
  morningStart: "08:00",
  morningEnd: "11:45",
  morningBreakTime: "10:00",
  morningBreakDur: 15,
  afternoonStart: "13:00",
  afternoonEnd: "16:45",
  afternoonBreakTime: "15:00",
  afternoonBreakDur: 15,
  extraHourDefault: false,
  extraHourDur: 60,
});

const state = {
  user: null,
  modules: [],
  classes: [],
  years: [],
  canvases: [],
  dates: [],
  activities: [],
  selected: {
    year: new Date().getFullYear(),
    moduleId: null,
    canvasId: null,
  },
};

const THEME_KEY = "knva_theme";

const applyTheme = (theme) => {
  document.body.classList.toggle("dark", theme === "dark");
  const btn = el("toggleTheme");
  if (btn) btn.textContent = theme === "dark" ? "Mode clair" : "Mode sombre";
};

const el = (id) => document.getElementById(id);

const authScreen = el("authScreen");
const authEmail = el("authEmail");
const authPassword = el("authPassword");
const authError = el("authError");
const userBadge = el("userBadge");

const moduleSelect = el("moduleSelect");
const classSelect = el("classSelect");
const yearSelect = el("yearSelect");
const canvasSelect = el("canvasSelect");
const moduleMeta = el("moduleMeta");
const canvasTitle = el("canvasTitle");
const canvasModule = el("canvasModule");
const canvasClass = el("canvasClass");
const weeklyObjectives = el("weeklyObjectives");
const datesList = el("datesList");
const dateInput = el("dateInput");
const activityList = el("activityList");
const schedule = el("schedule");
const printTitle = el("printTitle");
const printModule = el("printModule");
const printClass = el("printClass");
const printYear = el("printYear");
const printRows = el("printRows");
const printObjectives = el("printObjectives");

const settingsInputs = {
  blockMode: el("blockMode"),
  halfDayPeriod: el("halfDayPeriod"),
  morningStart: el("morningStart"),
  morningEnd: el("morningEnd"),
  morningBreakTime: el("morningBreakTime"),
  morningBreakDur: el("morningBreakDur"),
  afternoonStart: el("afternoonStart"),
  afternoonEnd: el("afternoonEnd"),
  afternoonBreakTime: el("afternoonBreakTime"),
  afternoonBreakDur: el("afternoonBreakDur"),
  extraHourDefault: el("extraHour"),
  extraHourDur: el("extraHourDur"),
};

const currentCanvas = () => state.canvases.find((c) => c.id === state.selected.canvasId);

const renderSelect = (select, items, selectedId, labelFn) => {
  select.innerHTML = "";
  items.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id ?? item;
    opt.textContent = labelFn(item);
    if ((item.id ?? item) === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
};

const renderModules = () => {
  const selectedId = state.selected.moduleId ?? currentCanvas()?.module_id;
  renderSelect(moduleSelect, state.modules, selectedId, (m) => m.name);
  const module = state.modules.find((m) => m.id === selectedId);
  moduleMeta.textContent = module ? module.description : "";
  canvasModule.value = module ? module.name : "";
};

const renderClasses = () => {
  renderSelect(classSelect, state.classes, currentCanvas()?.class_id, (c) => c.name);
  const cls = state.classes.find((c) => c.id === currentCanvas()?.class_id);
  canvasClass.value = cls ? cls.name : "";
};

const renderYears = () => {
  const years = [...state.years].sort((a, b) => b - a);
  renderSelect(yearSelect, years, state.selected.year, (y) => y);
};

const renderCanvases = () => {
  renderSelect(canvasSelect, state.canvases, state.selected.canvasId, (c) => c.title || "(Sans titre)");
};

const renderHeader = () => {
  const canvas = currentCanvas();
  if (!canvas) return;
  canvasTitle.value = canvas.title || "";
  weeklyObjectives.value = canvas.weekly_objectives || "";
};

const renderDates = () => {
  const canvas = currentCanvas();
  datesList.innerHTML = "";
  if (!canvas) return;
  const ordered = getOrderedDates();
  ordered.forEach((d, index) => {
    const dayType = getDayType(
      index,
      ordered.length,
      canvas.settings?.blockMode || "half-full",
      canvas.settings?.halfDayPeriod || "pm"
    );
    const chip = document.createElement("div");
    chip.className = "chip";
    const text = document.createElement("span");
    if (dayType === "am") text.textContent = `${d.date} (Demi-journée matin)`;
    else if (dayType === "pm") text.textContent = `${d.date} (Demi-journée après-midi)`;
    else text.textContent = d.date;
    const toggle = document.createElement("button");
    toggle.className = "btn small ghost";
    toggle.textContent = d.extra_hour ? "Heure +1" : "Heure normale";
    toggle.addEventListener("click", async () => {
      await api(`/api/dates/${d.id}`, {
        method: "PUT",
        body: JSON.stringify({ date: d.date, extra_hour: !d.extra_hour }),
      });
      d.extra_hour = d.extra_hour ? 0 : 1;
      renderSchedule();
      renderDates();
    });
    const remove = document.createElement("button");
    remove.className = "btn small ghost danger";
    remove.textContent = "Retirer";
    remove.addEventListener("click", async () => {
      await api(`/api/dates/${d.id}`, { method: "DELETE" });
      state.dates = state.dates.filter((x) => x.id !== d.id);
      state.activities.forEach((a) => {
        if (a.day_id === d.id) a.day_id = null;
      });
      renderActivities();
      renderSchedule();
      renderDates();
    });
    chip.append(text, toggle, remove);
    datesList.appendChild(chip);
  });
};

const createDayOptions = (select, selectedDayId) => {
  select.innerHTML = "";
  if (state.dates.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Aucune date";
    select.appendChild(opt);
    return;
  }
  const ordered = getOrderedDates();
  ordered.forEach((d, index) => {
    const dayType = getDayType(
      index,
      ordered.length,
      currentCanvas()?.settings?.blockMode || "half-full",
      currentCanvas()?.settings?.halfDayPeriod || "pm"
    );
    const opt = document.createElement("option");
    opt.value = d.id;
    if (dayType === "am") opt.textContent = `${d.date} (Demi-journée matin)`;
    else if (dayType === "pm") opt.textContent = `${d.date} (Demi-journée après-midi)`;
    else opt.textContent = d.date;
    if (d.id === selectedDayId) opt.selected = true;
    select.appendChild(opt);
  });
};

let draggedId = null;

const attachDragEvents = (element, activityId) => {
  element.addEventListener("dragstart", (e) => {
    draggedId = activityId;
    element.classList.add("dragging");
    e.dataTransfer.effectAllowed = "move";
  });
  element.addEventListener("dragend", () => {
    element.classList.remove("dragging");
    draggedId = null;
  });
  element.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  element.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (!draggedId || draggedId === activityId) return;
    const fromIndex = state.activities.findIndex((a) => a.id === draggedId);
    const toIndex = state.activities.findIndex((a) => a.id === activityId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = state.activities.splice(fromIndex, 1);
    state.activities.splice(toIndex, 0, moved);
    renderActivities();
    await api("/api/activities/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: state.activities.map((a) => a.id) }),
    });
  });
};

const renderActivities = () => {
  const canvas = currentCanvas();
  activityList.innerHTML = "";
  if (!canvas) return;
  const template = document.getElementById("activityTemplate");

  state.activities.forEach((activity) => {
    const node = template.content.cloneNode(true);
    const root = node.querySelector(".activity");
    root.dataset.id = activity.id;

    const name = node.querySelector(".activity-name");
    const duration = node.querySelector(".activity-duration");
    const desc = node.querySelector(".activity-desc");
    const obj = node.querySelector(".activity-obj");
    const material = node.querySelector(".activity-material");
    const comment = node.querySelector(".activity-comment");
    const daySelect = node.querySelector(".activity-day");

    name.value = activity.name;
    duration.value = activity.duration;
    desc.value = activity.description;
    obj.value = activity.objective;
    material.value = activity.material || "";
    comment.value = activity.comment;

    createDayOptions(daySelect, activity.day_id);

    name.addEventListener("input", () => updateActivity(activity.id, { name: name.value }));
    duration.addEventListener("input", () => updateActivity(activity.id, { duration: Number(duration.value || 0) }));
    desc.addEventListener("input", () => updateActivity(activity.id, { description: desc.value }));
    obj.addEventListener("input", () => updateActivity(activity.id, { objective: obj.value }));
    material.addEventListener("input", () => updateActivity(activity.id, { material: material.value }));
    comment.addEventListener("input", () => updateActivity(activity.id, { comment: comment.value }));

    daySelect.addEventListener("change", () => updateActivity(activity.id, { day_id: daySelect.value || null }));

    root.querySelector(".minus").addEventListener("click", () => {
      const newVal = Math.max(5, Number(duration.value || 0) - 5);
      duration.value = newVal;
      updateActivity(activity.id, { duration: newVal });
    });

    root.querySelector(".plus").addEventListener("click", () => {
      const newVal = Number(duration.value || 0) + 5;
      duration.value = newVal;
      updateActivity(activity.id, { duration: newVal });
    });

    root.querySelector(".remove").addEventListener("click", async () => {
      await api(`/api/activities/${activity.id}`, { method: "DELETE" });
      state.activities = state.activities.filter((a) => a.id !== activity.id);
      renderActivities();
      renderSchedule();
    });

    attachDragEvents(root, activity.id);

    activityList.appendChild(node);
  });
};

const updateActivity = async (id, patch) => {
  const activity = state.activities.find((a) => a.id === id);
  if (!activity) return;
  const next = { ...activity, ...patch };
  const updated = await api(`/api/activities/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      day_id: next.day_id,
      name: next.name,
      duration: next.duration,
      description: next.description,
      objective: next.objective,
      material: next.material,
      comment: next.comment,
    }),
  });
  Object.assign(activity, updated);
  renderSchedule();
};

const timeToMin = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

const minToTime = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const getBreaks = (settings, dayType) => {
  const breaks = [];
  const morningStart = timeToMin(settings.morningStart);
  const morningEnd = timeToMin(settings.morningEnd);
  const afternoonStart = timeToMin(settings.afternoonStart);
  const afternoonEnd = timeToMin(settings.afternoonEnd);

  if (dayType === "full" || dayType === "am") {
    const mbStart = timeToMin(settings.morningBreakTime);
    const mbEnd = mbStart + Number(settings.morningBreakDur || 0);
    if (mbStart > morningStart && mbStart < morningEnd) {
      breaks.push({ start: mbStart, end: mbEnd, label: "Pause matin" });
    }

    if (dayType === "full" && afternoonStart > morningEnd) {
      breaks.push({ start: morningEnd, end: afternoonStart, label: "Pause midi" });
    }
  }

  const abStart = timeToMin(settings.afternoonBreakTime);
  const abEnd = abStart + Number(settings.afternoonBreakDur || 0);
  if ((dayType === "full" || dayType === "pm") && abStart > afternoonStart && abStart < afternoonEnd) {
    breaks.push({ start: abStart, end: abEnd, label: "Pause ap.-midi" });
  }

  return breaks.sort((a, b) => a.start - b.start);
};

const getDayEnd = (settings, extraHour, dayType) => {
  const base =
    dayType === "am" ? timeToMin(settings.morningEnd) : timeToMin(settings.afternoonEnd);
  if (dayType === "am") return base;
  if (!extraHour) return base;
  return base + Number(settings.extraHourDur || 60);
};

const getOrderedDates = () => [...state.dates].sort((a, b) => a.date.localeCompare(b.date));

const getDayType = (index, total, blockMode, halfDayPeriod) => {
  const halfType = halfDayPeriod === "am" ? "am" : "pm";
  if (blockMode === "half") return halfType;
  if (total % 2 === 1 && index === total - 1) return "full";
  if (blockMode === "half-full") return index % 2 === 0 ? halfType : "full";
  return index % 2 === 0 ? "full" : halfType;
};

const renderSchedule = () => {
  const canvas = currentCanvas();
  schedule.innerHTML = "";
  if (!canvas) return;

  const settings = canvas.settings || defaultSettings();
  const orderedDates = state.dates.length > 0 ? getOrderedDates() : [{ id: "no-date", date: "Sans date", extra_hour: 0 }];

  orderedDates.forEach((day, index) => {
    const dayType =
      day.id === "no-date"
        ? "full"
        : getDayType(index, orderedDates.length, settings.blockMode || "half-full", settings.halfDayPeriod || "pm");
    const breaks = getBreaks(settings, dayType);
    const wrapper = document.createElement("div");
    wrapper.className = "day";
    const title = document.createElement("h3");
    if (dayType === "am") title.textContent = `${day.date} (Demi-journée matin)`;
    else if (dayType === "pm") title.textContent = `${day.date} (Demi-journée après-midi)`;
    else title.textContent = day.date;
    wrapper.appendChild(title);

    const activities = state.activities.filter((a) => a.day_id === day.id || (day.id === "no-date" && !a.day_id));
    let current = dayType === "pm" ? timeToMin(settings.afternoonStart) : timeToMin(settings.morningStart);
    const dayEnd = getDayEnd(settings, day.extra_hour || settings.extraHourDefault, dayType);
    let breakIndex = 0;

    const addSlot = (label, start, end, extraClass) => {
      const slot = document.createElement("div");
      slot.className = `slot${extraClass ? " " + extraClass : ""}`;
      slot.innerHTML = `<span>${label}</span><span>${minToTime(start)} - ${minToTime(end)}</span>`;
      wrapper.appendChild(slot);
    };

    const consumeBreaks = () => {
      while (breakIndex < breaks.length && current >= breaks[breakIndex].start) {
        const brk = breaks[breakIndex];
        if (current < brk.end) {
          addSlot(brk.label, brk.start, brk.end, "break");
          current = brk.end;
        }
        breakIndex += 1;
      }
    };

    consumeBreaks();

    activities.forEach((activity) => {
      consumeBreaks();
      const nextBreak = breaks.find((b) => b.start > current);
      if (nextBreak && current + activity.duration > nextBreak.start) {
        addSlot(nextBreak.label, nextBreak.start, nextBreak.end, "break");
        current = nextBreak.end;
      }
      const start = current;
      const end = current + Number(activity.duration || 0);
      const warn = end > dayEnd ? " warn" : "";
      addSlot(activity.name || "(Sans nom)", start, Math.min(end, dayEnd), warn);
      current = end;
    });

    consumeBreaks();

    if (current > dayEnd) {
      const slot = document.createElement("div");
      slot.className = "slot warn";
      slot.textContent = "Attention: la durée totale dépasse la journée.";
      wrapper.appendChild(slot);
    }

    schedule.appendChild(wrapper);
  });
};

const renderSettings = () => {
  const canvas = currentCanvas();
  if (!canvas) return;
  const settings = canvas.settings || defaultSettings();
  settingsInputs.blockMode.value = settings.blockMode || "half-full";
  settingsInputs.halfDayPeriod.value = settings.halfDayPeriod || "pm";
  settingsInputs.morningStart.value = settings.morningStart;
  settingsInputs.morningEnd.value = settings.morningEnd;
  settingsInputs.morningBreakTime.value = settings.morningBreakTime;
  settingsInputs.morningBreakDur.value = settings.morningBreakDur;
  settingsInputs.afternoonStart.value = settings.afternoonStart;
  settingsInputs.afternoonEnd.value = settings.afternoonEnd;
  settingsInputs.afternoonBreakTime.value = settings.afternoonBreakTime;
  settingsInputs.afternoonBreakDur.value = settings.afternoonBreakDur;
  settingsInputs.extraHourDefault.checked = settings.extraHourDefault;
  settingsInputs.extraHourDur.value = settings.extraHourDur;
};

const renderPrintSummary = () => {
  const canvas = currentCanvas();
  if (!canvas) return;
  printTitle.textContent = canvas.title || "Canevas";
  const module = state.modules.find((m) => m.id === canvas.module_id);
  const cls = state.classes.find((c) => c.id === canvas.class_id);
  printModule.textContent = module ? module.name : "";
  printClass.textContent = cls ? cls.name : "";
  printYear.textContent = String(canvas.year || "");
  printObjectives.textContent = canvas.weekly_objectives
    ? `Objectifs pédagogiques: ${canvas.weekly_objectives}`
    : "";

  const ordered = state.dates.length > 0 ? getOrderedDates() : [];
  const dateLabel = new Map();
  ordered.forEach((d, index) => {
    const dayType = getDayType(
      index,
      ordered.length,
      canvas.settings?.blockMode || "half-full",
      canvas.settings?.halfDayPeriod || "pm"
    );
    if (dayType === "am") dateLabel.set(d.id, `${d.date} (Demi-journée matin)`);
    else if (dayType === "pm") dateLabel.set(d.id, `${d.date} (Demi-journée après-midi)`);
    else dateLabel.set(d.id, d.date);
  });

  printRows.innerHTML = "";
  state.activities.forEach((activity) => {
    const tr = document.createElement("tr");
    const dateText = activity.day_id ? dateLabel.get(activity.day_id) || "" : "Sans date";
    tr.innerHTML = `
      <td>${dateText}</td>
      <td>${activity.name || ""}</td>
      <td>${activity.duration || 0}</td>
      <td>${activity.objective || ""}</td>
      <td>${activity.material || ""}</td>
      <td>${activity.comment || ""}</td>
    `;
    printRows.appendChild(tr);
  });
};

const renderAll = () => {
  const canvas = currentCanvas();
  if (!state.selected.moduleId && canvas) {
    state.selected.moduleId = canvas.module_id;
  }
  renderModules();
  renderClasses();
  renderYears();
  renderCanvases();
  renderHeader();
  renderDates();
  renderActivities();
  renderSettings();
  renderSchedule();
  renderPrintSummary();
};

const updateSettingsFromInputs = async () => {
  const canvas = currentCanvas();
  if (!canvas) return;
  canvas.settings = {
    blockMode: settingsInputs.blockMode.value,
    halfDayPeriod: settingsInputs.halfDayPeriod.value,
    morningStart: settingsInputs.morningStart.value,
    morningEnd: settingsInputs.morningEnd.value,
    morningBreakTime: settingsInputs.morningBreakTime.value,
    morningBreakDur: Number(settingsInputs.morningBreakDur.value || 0),
    afternoonStart: settingsInputs.afternoonStart.value,
    afternoonEnd: settingsInputs.afternoonEnd.value,
    afternoonBreakTime: settingsInputs.afternoonBreakTime.value,
    afternoonBreakDur: Number(settingsInputs.afternoonBreakDur.value || 0),
    extraHourDefault: settingsInputs.extraHourDefault.checked,
    extraHourDur: Number(settingsInputs.extraHourDur.value || 60),
  };
  await api(`/api/canvases/${canvas.id}`, {
    method: "PUT",
    body: JSON.stringify({
      year: canvas.year,
      module_id: canvas.module_id,
      class_id: canvas.class_id,
      title: canvas.title,
      weekly_objectives: canvas.weekly_objectives || "",
      settings: canvas.settings,
    }),
  });
  renderSchedule();
};

const loadCanvasData = async () => {
  const canvas = currentCanvas();
  if (!canvas) return;
  state.dates = await api(`/api/canvases/${canvas.id}/dates`);
  state.activities = await api(`/api/canvases/${canvas.id}/activities`);
};

const loadData = async () => {
  state.modules = await api("/api/modules");
  state.classes = await api("/api/classes");
  state.years = await api("/api/years");
  if (!state.years.includes(state.selected.year)) {
    state.years.push(state.selected.year);
  }
  if (!state.selected.moduleId && state.modules.length > 0) {
    state.selected.moduleId = state.modules[0].id;
  }
  const canvases = await api(
    `/api/canvases?year=${state.selected.year}&module_id=${state.selected.moduleId || ""}`
  );
  state.canvases = canvases;
  state.selected.canvasId = canvases[0]?.id || null;
  if (state.selected.canvasId) {
    await loadCanvasData();
  } else {
    state.dates = [];
    state.activities = [];
  }
  renderAll();
};

const attachEvents = () => {
  el("btnLogin").addEventListener("click", async () => {
    authError.textContent = "";
    try {
      const user = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: authEmail.value, password: authPassword.value }),
      });
      state.user = user;
      authScreen.classList.add("hidden");
      userBadge.textContent = user.email;
      await loadData();
    } catch (err) {
      authError.textContent = err.message;
    }
  });

  el("btnRegister").addEventListener("click", async () => {
    authError.textContent = "";
    try {
      const user = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: authEmail.value, password: authPassword.value }),
      });
      state.user = user;
      authScreen.classList.add("hidden");
      userBadge.textContent = user.email;
      await loadData();
    } catch (err) {
      authError.textContent = err.message;
    }
  });

  el("btnLogout").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST" });
    location.reload();
  });

  el("toggleTheme").addEventListener("click", () => {
    const current = localStorage.getItem(THEME_KEY) || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });

  el("addModule").addEventListener("click", async () => {
    const name = prompt("Nom du module ?");
    if (!name) return;
    const description = prompt("Description du module ?") || "";
    const module = await api("/api/modules", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
    state.modules.unshift(module);
    state.selected.moduleId = module.id;
    state.canvases = [];
    state.selected.canvasId = null;
    state.dates = [];
    state.activities = [];
    renderAll();
  });

  el("editModule").addEventListener("click", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    const module = state.modules.find((m) => m.id === canvas.module_id);
    if (!module) return;
    const name = prompt("Nom du module ?", module.name) || module.name;
    const description = prompt("Description du module ?", module.description) || module.description;
    const updated = await api(`/api/modules/${module.id}`, {
      method: "PUT",
      body: JSON.stringify({ name, description }),
    });
    Object.assign(module, updated);
    renderModules();
  });

  el("deleteModule").addEventListener("click", async () => {
    const canvas = currentCanvas();
    const module = state.modules.find((m) => m.id === state.selected.moduleId || m.id === canvas?.module_id);
    if (!module) return;
    if (!confirm(`Supprimer le module \"${module.name}\" ?`)) return;
    try {
      await api(`/api/modules/${module.id}`, { method: "DELETE" });
      state.modules = state.modules.filter((m) => m.id !== module.id);
      if (state.selected.moduleId === module.id) {
        state.selected.moduleId = state.modules[0]?.id || null;
        const canvases = state.selected.moduleId
          ? await api(`/api/canvases?year=${state.selected.year}&module_id=${state.selected.moduleId}`)
          : [];
        state.canvases = canvases;
        state.selected.canvasId = canvases[0]?.id || null;
        if (state.selected.canvasId) await loadCanvasData();
        else {
          state.dates = [];
          state.activities = [];
        }
      }
      renderAll();
    } catch (err) {
      alert(err.message);
    }
  });

  el("addClass").addEventListener("click", async () => {
    const name = prompt("Nom de la classe ?");
    if (!name) return;
    const cls = await api("/api/classes", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    state.classes.unshift(cls);
    renderClasses();
  });

  el("editClass").addEventListener("click", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    const cls = state.classes.find((c) => c.id === canvas.class_id);
    if (!cls) return;
    const name = prompt("Nom de la classe ?", cls.name) || cls.name;
    const updated = await api(`/api/classes/${cls.id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    Object.assign(cls, updated);
    renderClasses();
  });

  el("deleteClass").addEventListener("click", async () => {
    const canvas = currentCanvas();
    const cls = state.classes.find((c) => c.id === canvas?.class_id);
    if (!cls) return;
    if (!confirm(`Supprimer la classe \"${cls.name}\" ?`)) return;
    try {
      await api(`/api/classes/${cls.id}`, { method: "DELETE" });
      state.classes = state.classes.filter((c) => c.id !== cls.id);
      renderClasses();
    } catch (err) {
      alert(err.message);
    }
  });

  el("addYear").addEventListener("click", async () => {
    const year = Number(prompt("Année ? (ex: 2026)"));
    if (!year) return;
    if (!state.years.includes(year)) state.years.push(year);
    state.selected.year = year;
    const canvases = await api(`/api/canvases?year=${year}&module_id=${state.selected.moduleId || ""}`);
    state.canvases = canvases;
    state.selected.canvasId = canvases[0]?.id || null;
    if (state.selected.canvasId) await loadCanvasData();
    renderAll();
  });

  el("duplicatePrev").addEventListener("click", async () => {
    const currentYear = state.selected.year;
    await api("/api/canvases/duplicate-prev", {
      method: "POST",
      body: JSON.stringify({ year: currentYear }),
    });
    const canvases = await api(
      `/api/canvases?year=${currentYear}&module_id=${state.selected.moduleId || ""}`
    );
    state.canvases = canvases;
    state.selected.canvasId = canvases[0]?.id || null;
    if (state.selected.canvasId) await loadCanvasData();
    renderAll();
  });

  el("newCanvas").addEventListener("click", async () => {
    const title = prompt("Titre du canevas ?") || "Nouveau canevas";
    const moduleId = state.selected.moduleId || state.modules[0]?.id;
    const classId = Number(classSelect.value) || state.classes[0]?.id;
    if (!moduleId || !classId) {
      alert("Créez d'abord un module et une classe.");
      return;
    }
    const canvas = await api("/api/canvases", {
      method: "POST",
      body: JSON.stringify({
        year: state.selected.year,
        module_id: moduleId,
        class_id: classId,
        title,
        weekly_objectives: "",
        settings: defaultSettings(),
      }),
    });
    state.canvases.unshift(canvas);
    state.selected.canvasId = canvas.id;
    await loadCanvasData();
    renderAll();
  });

  el("deleteCanvas").addEventListener("click", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    if (!confirm("Supprimer ce canevas ?")) return;
    await api(`/api/canvases/${canvas.id}`, { method: "DELETE" });
    state.canvases = state.canvases.filter((c) => c.id !== canvas.id);
    state.selected.canvasId = state.canvases[0]?.id || null;
    await loadCanvasData();
    renderAll();
  });

  moduleSelect.addEventListener("change", async () => {
    state.selected.moduleId = Number(moduleSelect.value);
    const canvases = await api(
      `/api/canvases?year=${state.selected.year}&module_id=${state.selected.moduleId || ""}`
    );
    state.canvases = canvases;
    state.selected.canvasId = canvases[0]?.id || null;
    if (state.selected.canvasId) await loadCanvasData();
    renderAll();
  });

  classSelect.addEventListener("change", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    canvas.class_id = Number(classSelect.value);
    await api(`/api/canvases/${canvas.id}`, {
      method: "PUT",
      body: JSON.stringify({
        year: canvas.year,
        module_id: canvas.module_id,
        class_id: canvas.class_id,
        title: canvas.title,
        weekly_objectives: canvas.weekly_objectives || "",
        settings: canvas.settings,
      }),
    });
    renderClasses();
  });

  yearSelect.addEventListener("change", async () => {
    state.selected.year = Number(yearSelect.value);
    const canvases = await api(
      `/api/canvases?year=${state.selected.year}&module_id=${state.selected.moduleId || ""}`
    );
    state.canvases = canvases;
    state.selected.canvasId = canvases[0]?.id || null;
    if (state.selected.canvasId) await loadCanvasData();
    renderAll();
  });

  canvasSelect.addEventListener("change", async () => {
    state.selected.canvasId = Number(canvasSelect.value);
    const canvas = currentCanvas();
    if (canvas) state.selected.moduleId = canvas.module_id;
    await loadCanvasData();
    renderAll();
  });

  canvasTitle.addEventListener("input", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    canvas.title = canvasTitle.value;
    await api(`/api/canvases/${canvas.id}`, {
      method: "PUT",
      body: JSON.stringify({
        year: canvas.year,
        module_id: canvas.module_id,
        class_id: canvas.class_id,
        title: canvas.title,
        weekly_objectives: canvas.weekly_objectives || "",
        settings: canvas.settings,
      }),
    });
    renderCanvases();
  });

  weeklyObjectives.addEventListener("input", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    canvas.weekly_objectives = weeklyObjectives.value;
    await api(`/api/canvases/${canvas.id}`, {
      method: "PUT",
      body: JSON.stringify({
        year: canvas.year,
        module_id: canvas.module_id,
        class_id: canvas.class_id,
        title: canvas.title,
        weekly_objectives: canvas.weekly_objectives || "",
        settings: canvas.settings,
      }),
    });
    renderPrintSummary();
  });

  el("addDate").addEventListener("click", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    const date = dateInput.value;
    if (!date) return;
    const newDate = await api(`/api/canvases/${canvas.id}/dates`, {
      method: "POST",
      body: JSON.stringify({ date, extra_hour: canvas.settings?.extraHourDefault }),
    });
    state.dates.push(newDate);
    dateInput.value = "";
    renderDates();
    renderActivities();
    renderSchedule();
  });

  el("addActivity").addEventListener("click", async () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    const activity = await api(`/api/canvases/${canvas.id}/activities`, {
      method: "POST",
      body: JSON.stringify({
        name: "Nouvelle activité",
        duration: 30,
        description: "",
        objective: "",
        material: "",
        comment: "",
        day_id: state.dates[0]?.id || null,
      }),
    });
    state.activities.push(activity);
    renderActivities();
    renderSchedule();
  });

  Object.values(settingsInputs).forEach((input) => {
    input.addEventListener("input", updateSettingsFromInputs);
    input.addEventListener("change", updateSettingsFromInputs);
  });

  el("btnPrint").addEventListener("click", () => window.print());

  activityList.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  activityList.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (!draggedId) return;
    const overActivity = e.target.closest(".activity");
    if (overActivity) return;
    const fromIndex = state.activities.findIndex((a) => a.id === draggedId);
    if (fromIndex < 0) return;
    const [moved] = state.activities.splice(fromIndex, 1);
    state.activities.push(moved);
    renderActivities();
    await api("/api/activities/reorder", {
      method: "POST",
      body: JSON.stringify({ ids: state.activities.map((a) => a.id) }),
    });
  });
};

const init = async () => {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  attachEvents();
  const me = await api("/api/auth/me");
  if (!me.user) {
    authScreen.classList.remove("hidden");
    return;
  }
  state.user = me.user;
  userBadge.textContent = me.user.email;
  await loadData();
};

init();
