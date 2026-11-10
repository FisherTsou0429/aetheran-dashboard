import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

function minutes(time) {
  if (typeof time !== "string" || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [hour, minute] = time.split(":").map(Number);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

function validDay(day) {
  return Number.isSafeInteger(day) && day > 0;
}

function position(day, time) {
  const minute = minutes(time);
  return validDay(day) && minute !== null ? day * 1440 + minute : null;
}

function timeRange(time) {
  if (typeof time !== "string") return null;
  const match = /^(\d{1,2}:\d{2})(?:\s*[–—～-]\s*(\d{1,2}:\d{2}))?$/.exec(time);
  if (!match) return null;
  const start = minutes(match[1]);
  const end = minutes(match[2] ?? match[1]);
  return start !== null && end !== null && start <= end ? { start, end } : null;
}

const nonempty = value => typeof value === "string" && value.trim().length > 0;

function records(data, key, label) {
  if (!Array.isArray(data[key])) throw new Error(label + "缺少 " + key + " 陣列。");
  const index = new Map();
  for (const row of data[key]) {
    if (!nonempty(row?.id) || index.has(row.id)) {
      throw new Error(label + "的 " + key + " 含空白或重複 ID：" + (row?.id ?? "未填"));
    }
    index.set(row.id, row);
  }
  return index;
}

function changedRecords(previous, candidate, key, errors) {
  const before = records(previous, key, "上一版");
  const after = records(candidate, key, "候選版");
  for (const id of before.keys()) {
    if (!after.has(id)) errors.push(key + " 遺失既有 ID " + id + "，請保留歷史。");
  }
  const changed = [...after.values()].filter(row => !isDeepStrictEqual(row, before.get(row.id)));
  return { changed, after };
}

function checkExpectedIds(value, changed, label, errors) {
  const actual = changed.map(row => row.id).sort();
  if (!Array.isArray(value) || value.some(id => !nonempty(id))) {
    errors.push("請填寫 sync.changeSet." + label + "，列出從正式來源核對出的 ID。");
    return;
  }
  if (!isDeepStrictEqual([...value].sort(), actual)) {
    errors.push(label + " 與實際變更不符。應寫入：" + (value.join("、") || "無") +
      "。實際寫入：" + (actual.join("、") || "無") + "。");
  }
}

function validateSync(previous, candidate) {
  const errors = [];
  const before = previous.snapshot ?? {};
  const snapshot = candidate.snapshot ?? {};
  const beforePoint = position(before.gameDay, before.gameTime);
  const point = position(snapshot.gameDay, snapshot.gameTime);
  if (beforePoint === null || point === null) throw new Error("快照必須有正確的遊戲日期與時間。");
  if (point < beforePoint) errors.push("快照早於上一版，請以最新 main 重新合併。");

  const timeline = changedRecords(previous, candidate, "timeline", errors);
  const quests = changedRecords(previous, candidate, "quests", errors);
  const inventory = changedRecords(previous, candidate, "inventory", errors);
  const summaries = candidate.latestEvents ?? [];
  const { inventoryIds, ...receipt } = candidate.sync?.changeSet ?? {};
  const { inventoryIds: previousInventoryIds, ...previousReceipt } = previous.sync?.changeSet ?? {};
  const needsReceipt = !isDeepStrictEqual(before, snapshot) ||
    timeline.changed.length || quests.changed.length ||
    !isDeepStrictEqual(previous.latestEvents ?? [], summaries) ||
    !isDeepStrictEqual(previousReceipt, receipt);
  if (needsReceipt) {
    const reviewed = candidate.sync?.timelineVerifiedThrough;
    const sync = candidate.sync;
    if (position(reviewed?.gameDay, reviewed?.gameTime) !== point) {
      errors.push("sync.timelineVerifiedThrough 必須與本次快照一致，請先核對正式時間軸。");
    }
    if (position(sync?.lastGameDay, sync?.lastGameTime) !== point) {
      errors.push("同步時點與快照不一致，請更新 sync.lastGameDay／lastGameTime。");
    }
    checkExpectedIds(receipt?.timelineIds, timeline.changed, "timelineIds", errors);
    checkExpectedIds(receipt?.questIds, quests.changed, "questIds", errors);
    if (timeline.changed.length === 0 && receipt?.noImportantEvents !== true) {
      errors.push("沒有任何時間軸詳情變更。只有回查正式紀錄確定無重要事件時，才可填 noImportantEvents: true。");
    }
    if (timeline.changed.length > 0 && receipt?.noImportantEvents === true) {
      errors.push("已有時間軸變更，請移除 noImportantEvents: true。");
    }
  }

  if (needsReceipt || inventory.changed.length || !isDeepStrictEqual(previousInventoryIds, inventoryIds)) {
    checkExpectedIds(inventoryIds, inventory.changed, "inventoryIds", errors);
  }
  for (const row of inventory.changed) {
    if (![row.name, row.status, row.place, row.count, row.details, row.source].every(nonempty)) {
      errors.push("庫存 " + row.id + " 缺少名稱、狀態、保管位置、數量、明細或來源。");
    }
    if (row.items != null && (!Array.isArray(row.items) ||
        row.items.some(item => !Array.isArray(item) || item.length !== 2 || !item.every(nonempty)))) {
      errors.push("庫存 " + row.id + " 的批次品項須有名稱與數量。");
    }
  }

  for (const row of timeline.changed) {
    const range = timeRange(row.time);
    if (!validDay(row.day) || row.day > snapshot.gameDay ||
        (!range && /^\d{1,2}:/.test(row.time)) ||
        (range && row.day * 1440 + range.end > point)) {
      errors.push("事件 " + row.id + " 的時點超出快照或日期無效。");
    }
    if (!nonempty(row.title) || !nonempty(row.summary) || !nonempty(row.source) ||
        !(nonempty(row.details) || nonempty(row.outcome) ||
          (Array.isArray(row.steps) && row.steps.some(nonempty)))) {
      errors.push("事件 " + row.id + " 缺少標題、概要、來源或可展開的詳情。");
    }
  }

  if (!Array.isArray(summaries)) throw new Error("latestEvents 必須是陣列。");
  for (const row of summaries) {
    const event = timeline.after.get(row?.id);
    const stamp = position(row?.gameDay, row?.time);
    const minute = minutes(row?.time);
    const range = timeRange(event?.time);
    if (!event || stamp === null || stamp > point || event.day !== row.gameDay ||
        (range && (minute < range.start || minute > range.end))) {
      errors.push("摘要 " + (row?.id ?? row?.time ?? "未填") + " 找不到同日同時段的 timeline 詳情。");
    }
  }

  for (const row of quests.changed) {
    const detail = row.taskDetails;
    if (!nonempty(row.status) || !detail ||
        ![detail.progress, detail.completion, detail.payment, detail.requirements].some(nonempty)) {
      errors.push("任務 " + row.id + " 缺少狀態或 taskDetails 明細。");
    }
  }

  let pending = 0;
  for (const row of quests.after.values()) {
    if (row.paymentPendingCopper == null) continue;
    if (!Number.isSafeInteger(row.paymentPendingCopper) || row.paymentPendingCopper < 0) {
      errors.push("任務 " + row.id + " 的待領金額無效。");
    } else {
      pending += row.paymentPendingCopper;
    }
  }
  const approved = candidate.hero?.uncollectedApprovedCopper;
  if (approved != null && approved !== pending) {
    errors.push("已核准待領總額為 " + approved + "，任務明細只合計 " + pending + "。請核對驗收與付款。");
  }

  const lastEvent = [...timeline.after.values()].reduce((latest, row) => {
    const range = timeRange(row.time);
    if (!validDay(row.day) || !range) return latest;
    const order = row.day * 1440 + range.end;
    return !latest || order > latest.order ? { order, row } : latest;
  }, null)?.row;
  return { errors, timelineChanged: timeline.changed.length, questsChanged: quests.changed.length,
    inventoryChanged: inventory.changed.length, lastEvent };
}

try {
  const [previousPath, candidatePath] = process.argv.slice(2);
  if (!previousPath || !candidatePath) throw new Error("用法：node scripts/check-gh-sync.mjs 上一版.json 候選版.json");
  const load = path => JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
  const result = validateSync(load(previousPath), load(candidatePath));
  if (result.errors.length) throw new Error(result.errors.join("\n"));
  console.log("GH 同步檢查通過｜時間軸 " + result.timelineChanged + " 筆｜任務 " + result.questsChanged + " 筆｜庫存 " + result.inventoryChanged + " 筆");
  if (result.lastEvent) {
    const { day, time, title } = result.lastEvent;
    console.log("最新時間軸事件｜第" + day + "日 " + time + "｜" + title);
  }
} catch (error) {
  console.error("GH 同步檢查失敗\n" + error.message);
  process.exitCode = 1;
}
