"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const prefix = "aetheran-dashboard:todo:";
  const panel = document.getElementById("personal-todos");
  const form = document.getElementById("todo-form");
  const formTitle = document.getElementById("todo-form-title");
  const title = document.getElementById("todo-title");
  const day = document.getElementById("todo-day");
  const time = document.getElementById("todo-time");
  const notes = document.getElementById("todo-notes");
  const submit = document.getElementById("todo-submit");
  const cancel = document.getElementById("todo-cancel");
  const message = document.getElementById("todo-message");
  const template = document.getElementById("todo-item");
  let editingId = null;

  function announce(text, error = false) {
    message.textContent = text;
    message.toggleAttribute("data-error", error);
  }

  function readTodo(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return { ...JSON.parse(raw), id: key.slice(prefix.length) };
  }

  function makeItem(todo) {
    const item = template.content.firstElementChild.cloneNode(true);
    item.dataset.todoId = todo.id;
    item.querySelector("summary").textContent = todo.title;

    const deadline = item.querySelector(".todo-item-deadline");
    deadline.hidden = todo.dueDay === null;
    deadline.textContent = "到期 第" + todo.dueDay + "日" + (todo.dueTime ? " " + todo.dueTime : "");
    const note = item.querySelector(".todo-item-notes");
    note.hidden = !todo.notes;
    note.textContent = todo.notes;

    const checkbox = item.querySelector("[data-todo-done]");
    checkbox.checked = todo.done;
    checkbox.setAttribute("aria-label", "完成 " + todo.title);
    item.querySelector('[data-todo-action="edit"]').setAttribute("aria-label", "編輯 " + todo.title);
    item.querySelector('[data-todo-action="delete"]').setAttribute("aria-label", "刪除 " + todo.title);
    return item;
  }

  function renderTodos() {
    try {
      const todos = Object.keys(localStorage).filter(key => key.startsWith(prefix))
        .map(readTodo).filter(Boolean);
      todos.sort((a, b) => (a.dueDay ?? Infinity) - (b.dueDay ?? Infinity) ||
        a.dueTime.localeCompare(b.dueTime) || a.createdAt - b.createdAt);
      for (const [group, done] of [["open", false], ["done", true]]) {
        const items = todos.filter(todo => todo.done === done).map(makeItem);
        document.getElementById("todo-" + group).replaceChildren(...items);
        document.getElementById("todo-" + group + "-empty").hidden = items.length > 0;
        document.getElementById("todo-" + group + "-count").textContent = items.length + " 筆";
      }
    } catch {
      announce("無法讀取此瀏覽器的待辦資料。", true);
    }
  }

  function resetEditor() {
    editingId = null;
    form.reset();
    formTitle.textContent = "新增待辦";
    submit.textContent = "新增待辦";
    cancel.hidden = true;
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    const name = title.value.trim();
    const dueDay = day.value === "" ? null : day.valueAsNumber;
    if (!name) {
      announce("請輸入待辦名稱。", true);
      title.focus();
      return;
    }
    if ((dueDay !== null && (!Number.isSafeInteger(dueDay) || dueDay < 1)) ||
        (dueDay === null && time.value)) {
      announce("請填寫有效的遊戲到期日。", true);
      day.focus();
      return;
    }
    try {
      const id = editingId ?? crypto.randomUUID();
      const key = prefix + id;
      const current = editingId ? readTodo(key) : null;
      if (editingId && !current) {
        announce("這筆待辦已不存在。可複製內容後取消編輯，再重新新增。", true);
        return;
      }
      localStorage.setItem(key, JSON.stringify({
        title: name,
        notes: notes.value.trim(),
        dueDay,
        dueTime: time.value,
        done: current?.done ?? false,
        createdAt: current?.createdAt ?? Date.now()
      }));
      announce(editingId ? "已儲存修改。" : "已新增待辦。");
      resetEditor();
      renderTodos();
      title.focus();
    } catch {
      announce("儲存失敗。請檢查瀏覽器是否允許儲存網站資料。", true);
    }
  });

  cancel.addEventListener("click", () => {
    resetEditor();
    announce("");
    title.focus();
  });

  panel.addEventListener("click", event => {
    const button = event.target.closest("[data-todo-action]");
    if (!button) return;
    const id = button.closest("[data-todo-id]").dataset.todoId;
    const key = prefix + id;
    try {
      const todo = readTodo(key);
      if (!todo) {
        renderTodos();
        announce("這筆待辦已不存在。", true);
        return;
      }
      if (button.dataset.todoAction === "edit") {
        editingId = id;
        formTitle.textContent = "編輯待辦";
        submit.textContent = "儲存修改";
        cancel.hidden = false;
        title.value = todo.title;
        day.value = todo.dueDay ?? "";
        time.value = todo.dueTime;
        notes.value = todo.notes;
        announce("");
        title.focus();
        return;
      }
      if (!window.confirm("刪除「" + todo.title + "」？")) return;
      localStorage.removeItem(key);
      if (editingId === id) resetEditor();
      announce("已刪除待辦。");
      renderTodos();
      title.focus();
    } catch {
      announce("無法處理這筆待辦。請檢查瀏覽器的網站資料設定。", true);
    }
  });

  panel.addEventListener("change", event => {
    const checkbox = event.target;
    if (!checkbox.matches("[data-todo-done]")) return;
    const id = checkbox.closest("[data-todo-id]").dataset.todoId;
    const key = prefix + id;
    try {
      const todo = readTodo(key);
      if (!todo) {
        renderTodos();
        announce("這筆待辦已不存在。", true);
        return;
      }
      const { id: itemId, ...record } = todo;
      localStorage.setItem(key, JSON.stringify({ ...record, done: checkbox.checked }));
      announce(checkbox.checked ? "已標記完成。" : "已移回待處理。");
      renderTodos();
      panel.querySelector('[data-todo-id="' + CSS.escape(itemId) + '"] summary')?.focus();
    } catch {
      checkbox.checked = !checkbox.checked;
      announce("無法更新完成狀態。請檢查瀏覽器的網站資料設定。", true);
    }
  });

  window.addEventListener("storage", event => {
    if (event.key === null || event.key.startsWith(prefix)) renderTodos();
  });
  renderTodos();
});
