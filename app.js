const STORAGE_KEY = "knva_canevas_v1";

const defaultSettings = () => ({
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

const createId = () => Math.random().toString(36).slice(2, 10);

const todayYear = new Date().getFullYear();

const defaultState = () => {
  const moduleId = createId();
  const classId = createId();
  const canvasId = createId();
  return {
    modules: [
      { id: moduleId, name: "Module 1", description: "Décrire le module" },
    ],
    classes: [
      { id: classId, name: "Classe A" },
    ],
    years: [todayYear - 1, todayYear],
    canvases: [
      {
        id: canvasId,
        year: todayYear,
        moduleId,
        classId,
        title: "Canevas principal",
        dates: [],
        activities: [],
        settings: defaultSettings(),
      },
    ],
    selected: {
      moduleId,
      classId,
      year: todayYear,
      canvasId,
    },
  };
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const state = JSON.parse(raw);
    if (!state.modules || !state.classes || !state.canvases) return defaultState();
    return state;
  } catch {
    return defaultState();
  }
};

const saveState = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

let state = loadState();

const el = (id) => document.getElementById(id);

const moduleSelect = el("moduleSelect");
const classSelect = el("classSelect");
const yearSelect = el("yearSelect");
const canvasSelect = el("canvasSelect");
const moduleMeta = el("moduleMeta");
const canvasTitle = el("canvasTitle");
const canvasModule = el("canvasModule");
const canvasClass = el("canvasClass");
const datesList = el("datesList");
const dateInput = el("dateInput");
const activityList = el("activityList");
const schedule = el("schedule");

const settingsInputs = {
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
  renderSelect(moduleSelect, state.modules, state.selected.moduleId, (m) => m.name);
  const module = state.modules.find((m) => m.id === state.selected.moduleId);
  moduleMeta.textContent = module ? module.description : "";
  canvasModule.value = module ? module.name : "";
};

const renderClasses = () => {
  renderSelect(classSelect, state.classes, state.selected.classId, (c) => c.name);
  const cls = state.classes.find((c) => c.id === state.selected.classId);
  canvasClass.value = cls ? cls.name : "";
};

const renderYears = () => {
  const years = [...state.years].sort((a, b) => b - a);
  renderSelect(yearSelect, years, state.selected.year, (y) => y);
};

const renderCanvases = () => {
  const canvases = state.canvases.filter((c) => c.year === state.selected.year);
  renderSelect(canvasSelect, canvases, state.selected.canvasId, (c) => c.title || "(Sans titre)");
  if (!canvases.find((c) => c.id === state.selected.canvasId)) {
    state.selected.canvasId = canvases[0]?.id || null;
  }
};

const renderHeader = () => {
  const canvas = currentCanvas();
  if (!canvas) return;
  canvasTitle.value = canvas.title || "";
};

const renderDates = () => {
  const canvas = currentCanvas();
  datesList.innerHTML = "";
  if (!canvas) return;
  canvas.dates.forEach((d) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    const text = document.createElement("span");
    text.textContent = d.date;
    const toggle = document.createElement("button");
    toggle.className = "btn small ghost";
    toggle.textContent = d.extraHour ? "Heure +1" : "Heure normale";
    toggle.addEventListener("click", () => {
      d.extraHour = !d.extraHour;
      saveState();
      renderSchedule();
      renderDates();
    });
    const remove = document.createElement("button");
    remove.className = "btn small ghost danger";
    remove.textContent = "Retirer";
    remove.addEventListener("click", () => {
      canvas.dates = canvas.dates.filter((x) => x.id !== d.id);
      canvas.activities.forEach((a) => {
        if (a.dayId === d.id) a.dayId = canvas.dates[0]?.id || null;
      });
      saveState();
      renderActivities();
      renderSchedule();
      renderDates();
    });
    chip.append(text, toggle, remove);
    datesList.appendChild(chip);
  });
};

const createDayOptions = (select, canvas, selectedDayId) => {
  select.innerHTML = "";
  if (canvas.dates.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Aucune date";
    select.appendChild(opt);
    return;
  }
  canvas.dates.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.date;
    if (d.id === selectedDayId) opt.selected = true;
    select.appendChild(opt);
  });
};

const renderActivities = () => {
  const canvas = currentCanvas();
  activityList.innerHTML = "";
  if (!canvas) return;
  const template = document.getElementById("activityTemplate");

  canvas.activities.forEach((activity, index) => {
    const node = template.content.cloneNode(true);
    const root = node.querySelector(".activity");

    const name = node.querySelector(".activity-name");
    const duration = node.querySelector(".activity-duration");
    const desc = node.querySelector(".activity-desc");
    const obj = node.querySelector(".activity-obj");
    const comment = node.querySelector(".activity-comment");
    const daySelect = node.querySelector(".activity-day");

    name.value = activity.name;
    duration.value = activity.duration;
    desc.value = activity.description;
    obj.value = activity.objective;
    comment.value = activity.comment;

    createDayOptions(daySelect, canvas, activity.dayId);

    name.addEventListener("input", () => {
      activity.name = name.value;
      saveState();
      renderSchedule();
    });

    duration.addEventListener("input", () => {
      activity.duration = parseInt(duration.value || "0", 10);
      saveState();
      renderSchedule();
    });

    desc.addEventListener("input", () => {
      activity.description = desc.value;
      saveState();
    });

    obj.addEventListener("input", () => {
      activity.objective = obj.value;
      saveState();
    });

    comment.addEventListener("input", () => {
      activity.comment = comment.value;
      saveState();
    });

    daySelect.addEventListener("change", () => {
      activity.dayId = daySelect.value || null;
      saveState();
      renderSchedule();
    });

    root.querySelector(".minus").addEventListener("click", () => {
      activity.duration = Math.max(5, activity.duration - 5);
      duration.value = activity.duration;
      saveState();
      renderSchedule();
    });

    root.querySelector(".plus").addEventListener("click", () => {
      activity.duration += 5;
      duration.value = activity.duration;
      saveState();
      renderSchedule();
    });

    root.querySelector(".remove").addEventListener("click", () => {
      canvas.activities.splice(index, 1);
      saveState();
      renderActivities();
      renderSchedule();
    });

    root.querySelector(".up").addEventListener("click", () => {
      if (index === 0) return;
      const temp = canvas.activities[index - 1];
      canvas.activities[index - 1] = canvas.activities[index];
      canvas.activities[index] = temp;
      saveState();
      renderActivities();
      renderSchedule();
    });

    root.querySelector(".down").addEventListener("click", () => {
      if (index === canvas.activities.length - 1) return;
      const temp = canvas.activities[index + 1];
      canvas.activities[index + 1] = canvas.activities[index];
      canvas.activities[index] = temp;
      saveState();
      renderActivities();
      renderSchedule();
    });

    activityList.appendChild(node);
  });
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

const getBreaks = (settings) => {
  const breaks = [];
  const morningStart = timeToMin(settings.morningStart);
  const morningEnd = timeToMin(settings.morningEnd);
  const afternoonStart = timeToMin(settings.afternoonStart);
  const afternoonEnd = timeToMin(settings.afternoonEnd);

  const mbStart = timeToMin(settings.morningBreakTime);
  const mbEnd = mbStart + Number(settings.morningBreakDur || 0);
  if (mbStart > morningStart && mbStart < morningEnd) {
    breaks.push({ start: mbStart, end: mbEnd, label: "Pause matin" });
  }

  if (afternoonStart > morningEnd) {
    breaks.push({ start: morningEnd, end: afternoonStart, label: "Pause midi" });
  }

  const abStart = timeToMin(settings.afternoonBreakTime);
  const abEnd = abStart + Number(settings.afternoonBreakDur || 0);
  if (abStart > afternoonStart && abStart < afternoonEnd) {
    breaks.push({ start: abStart, end: abEnd, label: "Pause ap.-midi" });
  }

  return breaks.sort((a, b) => a.start - b.start);
};

const getDayEnd = (settings, extraHour) => {
  const base = timeToMin(settings.afternoonEnd);
  if (!extraHour) return base;
  return base + Number(settings.extraHourDur || 60);
};

const renderSchedule = () => {
  const canvas = currentCanvas();
  schedule.innerHTML = "";
  if (!canvas) return;

  const settings = canvas.settings;
  const breaks = getBreaks(settings);

  const dates = canvas.dates.length > 0 ? canvas.dates : [{ id: "no-date", date: "Sans date", extraHour: false }];

  dates.forEach((day) => {
    const wrapper = document.createElement("div");
    wrapper.className = "day";
    const title = document.createElement("h3");
    title.textContent = day.date;
    wrapper.appendChild(title);

    const activities = canvas.activities.filter((a) => a.dayId === day.id || (day.id === "no-date" && !a.dayId));
    let current = timeToMin(settings.morningStart);
    const dayEnd = getDayEnd(settings, day.extraHour ?? settings.extraHourDefault);
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
  const settings = canvas.settings;
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

const renderAll = () => {
  const canvas = currentCanvas();
  if (canvas) {
    state.selected.moduleId = canvas.moduleId;
    state.selected.classId = canvas.classId;
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
};

const updateSettingsFromInputs = () => {
  const canvas = currentCanvas();
  if (!canvas) return;
  const settings = canvas.settings;
  settings.morningStart = settingsInputs.morningStart.value;
  settings.morningEnd = settingsInputs.morningEnd.value;
  settings.morningBreakTime = settingsInputs.morningBreakTime.value;
  settings.morningBreakDur = Number(settingsInputs.morningBreakDur.value || 0);
  settings.afternoonStart = settingsInputs.afternoonStart.value;
  settings.afternoonEnd = settingsInputs.afternoonEnd.value;
  settings.afternoonBreakTime = settingsInputs.afternoonBreakTime.value;
  settings.afternoonBreakDur = Number(settingsInputs.afternoonBreakDur.value || 0);
  settings.extraHourDefault = settingsInputs.extraHourDefault.checked;
  settings.extraHourDur = Number(settingsInputs.extraHourDur.value || 60);
  saveState();
  renderSchedule();
};

const attachEvents = () => {
  el("addModule").addEventListener("click", () => {
    const name = prompt("Nom du module ?");
    if (!name) return;
    const description = prompt("Description du module ?") || "";
    const id = createId();
    state.modules.push({ id, name, description });
    state.selected.moduleId = id;
    const canvas = currentCanvas();
    if (canvas) canvas.moduleId = id;
    saveState();
    renderAll();
  });

  el("editModule").addEventListener("click", () => {
    const module = state.modules.find((m) => m.id === state.selected.moduleId);
    if (!module) return;
    const name = prompt("Nom du module ?", module.name) || module.name;
    const description = prompt("Description du module ?", module.description) || module.description;
    module.name = name;
    module.description = description;
    saveState();
    renderAll();
  });

  el("addClass").addEventListener("click", () => {
    const name = prompt("Nom de la classe ?");
    if (!name) return;
    const id = createId();
    state.classes.push({ id, name });
    state.selected.classId = id;
    const canvas = currentCanvas();
    if (canvas) canvas.classId = id;
    saveState();
    renderAll();
  });

  el("editClass").addEventListener("click", () => {
    const cls = state.classes.find((c) => c.id === state.selected.classId);
    if (!cls) return;
    const name = prompt("Nom de la classe ?", cls.name) || cls.name;
    cls.name = name;
    saveState();
    renderAll();
  });

  el("addYear").addEventListener("click", () => {
    const year = Number(prompt("Année ? (ex: 2026)"));
    if (!year) return;
    if (!state.years.includes(year)) state.years.push(year);
    state.selected.year = year;
    saveState();
    renderAll();
  });

  el("duplicatePrev").addEventListener("click", () => {
    const currentYear = state.selected.year;
    const prevYears = state.years.filter((y) => y < currentYear);
    if (prevYears.length === 0) {
      alert("Aucune année précédente à dupliquer.");
      return;
    }
    const prevYear = Math.max(...prevYears);
    const prevCanvases = state.canvases.filter((c) => c.year === prevYear);
    if (prevCanvases.length === 0) {
      alert("Aucun canevas à dupliquer pour l'année précédente.");
      return;
    }
    const duplicated = prevCanvases.map((c) => {
      const newId = createId();
      return {
        ...JSON.parse(JSON.stringify(c)),
        id: newId,
        year: currentYear,
        title: `${c.title} (copie ${currentYear})`,
        dates: c.dates.map((d) => ({
          ...d,
          id: createId(),
          date: shiftDateYear(d.date, currentYear),
        })),
        activities: c.activities.map((a) => ({
          ...a,
          id: createId(),
        })),
      };
    });
    state.canvases.push(...duplicated);
    state.selected.canvasId = duplicated[0].id;
    saveState();
    renderAll();
  });

  el("newCanvas").addEventListener("click", () => {
    const title = prompt("Titre du canevas ?") || "Nouveau canevas";
    const id = createId();
    state.canvases.push({
      id,
      year: state.selected.year,
      moduleId: state.selected.moduleId,
      classId: state.selected.classId,
      title,
      dates: [],
      activities: [],
      settings: defaultSettings(),
    });
    state.selected.canvasId = id;
    saveState();
    renderAll();
  });

  el("deleteCanvas").addEventListener("click", () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    if (!confirm("Supprimer ce canevas ?")) return;
    state.canvases = state.canvases.filter((c) => c.id !== canvas.id);
    state.selected.canvasId = state.canvases[0]?.id || null;
    saveState();
    renderAll();
  });

  moduleSelect.addEventListener("change", () => {
    state.selected.moduleId = moduleSelect.value;
    const canvas = currentCanvas();
    if (canvas) canvas.moduleId = state.selected.moduleId;
    saveState();
    renderAll();
  });

  classSelect.addEventListener("change", () => {
    state.selected.classId = classSelect.value;
    const canvas = currentCanvas();
    if (canvas) canvas.classId = state.selected.classId;
    saveState();
    renderAll();
  });

  yearSelect.addEventListener("change", () => {
    state.selected.year = Number(yearSelect.value);
    const canvases = state.canvases.filter((c) => c.year === state.selected.year);
    state.selected.canvasId = canvases[0]?.id || null;
    saveState();
    renderAll();
  });

  canvasSelect.addEventListener("change", () => {
    state.selected.canvasId = canvasSelect.value;
    const canvas = currentCanvas();
    if (canvas) {
      state.selected.moduleId = canvas.moduleId;
      state.selected.classId = canvas.classId;
    }
    saveState();
    renderAll();
  });

  canvasTitle.addEventListener("input", () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    canvas.title = canvasTitle.value;
    saveState();
    renderCanvases();
  });

  el("addDate").addEventListener("click", () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    const date = dateInput.value;
    if (!date) return;
    canvas.dates.push({ id: createId(), date, extraHour: canvas.settings.extraHourDefault });
    dateInput.value = "";
    saveState();
    renderDates();
    renderActivities();
    renderSchedule();
  });

  el("addActivity").addEventListener("click", () => {
    const canvas = currentCanvas();
    if (!canvas) return;
    canvas.activities.push({
      id: createId(),
      name: "Nouvelle activité",
      duration: 30,
      description: "",
      objective: "",
      comment: "",
      dayId: canvas.dates[0]?.id || null,
    });
    saveState();
    renderActivities();
    renderSchedule();
  });

  Object.values(settingsInputs).forEach((input) => {
    input.addEventListener("input", updateSettingsFromInputs);
    input.addEventListener("change", updateSettingsFromInputs);
  });

  el("btnPrint").addEventListener("click", () => window.print());

  el("btnExport").addEventListener("click", () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canevas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  el("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!imported.modules || !imported.canvases) {
          alert("Fichier invalide.");
          return;
        }
        state = imported;
        saveState();
        renderAll();
      } catch {
        alert("Impossible de lire le fichier.");
      }
    };
    reader.readAsText(file);
  });
};

const shiftDateYear = (dateStr, newYear) => {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  parts[0] = String(newYear);
  return parts.join("-");
};

attachEvents();
renderAll();
