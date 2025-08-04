// 設定画面のJavaScript
console.log("設定画面が読み込まれました");

// DOM要素の取得
const settingsForm = document.getElementById("settingsForm");
const userNumberInput = document.getElementById("userNumber");
const autoExecuteCheckbox = document.getElementById("autoExecute");
const resetButton = document.getElementById("resetButton");
const status = document.getElementById("status");

// 初期化
document.addEventListener("DOMContentLoaded", async () => {
  console.log("設定画面の初期化を開始");

  // 保存された設定を読み込み
  await loadSettings();

  // イベントリスナーの設定
  setupEventListeners();
});

// イベントリスナーの設定
function setupEventListeners() {
  // フォーム送信イベント
  settingsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await saveSettings();
  });

  // リセットボタンのクリックイベント
  resetButton.addEventListener("click", async () => {
    if (confirm("すべての設定をリセットしますか？この操作は元に戻せません。")) {
      await resetSettings();
    }
  });

  // 入力フィールドの変更を監視（自動保存のオプション）
  const inputs = [userNumberInput, autoExecuteCheckbox];
  inputs.forEach((input) => {
    input.addEventListener("change", () => {
      // 自動保存が有効な場合の処理
      console.log(
        "設定が変更されました:",
        input.name,
        input.value || input.checked
      );
    });
  });
}

// 設定の読み込み
async function loadSettings() {
  try {
    console.log("設定を読み込み中...");

    const result = await chrome.storage.sync.get(["userNumber", "autoExecute"]);

    // フォームに値を設定
    if (result.userNumber) {
      userNumberInput.value = result.userNumber;
    }

    if (result.autoExecute !== undefined) {
      autoExecuteCheckbox.checked = result.autoExecute;
    }

    console.log("設定の読み込みが完了しました:", result);
  } catch (error) {
    console.error("設定の読み込みに失敗しました:", error);
    showStatus("設定の読み込みに失敗しました", "error");
  }
}

// 設定の保存
async function saveSettings() {
  try {
    console.log("設定を保存中...");

    // フォームデータを取得
    const formData = {
      userNumber: userNumberInput.value.trim(),
      autoExecute: autoExecuteCheckbox.checked,
      lastUpdated: Date.now(),
    };

    // バリデーション
    if (!formData.userNumber) {
      showStatus("利用者番号は必須です", "error");
      userNumberInput.focus();
      return;
    }

    // 設定を保存
    await chrome.storage.sync.set(formData);

    console.log("設定が保存されました:", formData);
    showStatus("設定が正常に保存されました", "success");

    // バックグラウンドスクリプトに設定変更を通知
    chrome.runtime.sendMessage({
      type: "settingsUpdated",
      data: formData,
    });
  } catch (error) {
    console.error("設定の保存に失敗しました:", error);
    showStatus("設定の保存に失敗しました", "error");
  }
}

// 設定のリセット
async function resetSettings() {
  try {
    console.log("設定をリセット中...");

    // デフォルト設定
    const defaultSettings = {
      userNumber: "",
      autoExecute: false,
      lastUpdated: Date.now(),
    };

    // 設定を保存
    await chrome.storage.sync.set(defaultSettings);

    // フォームをリセット
    userNumberInput.value = "";
    autoExecuteCheckbox.checked = false;

    console.log("設定がリセットされました");
    showStatus("設定がリセットされました", "success");
  } catch (error) {
    console.error("設定のリセットに失敗しました:", error);
    showStatus("設定のリセットに失敗しました", "error");
  }
}

// ステータスメッセージの表示
function showStatus(message, type = "success") {
  status.textContent = message;
  status.className = `status ${type}`;
  status.classList.add("show");

  // 3秒後に非表示
  setTimeout(() => {
    status.classList.remove("show");
  }, 3000);
}

// バックグラウンドスクリプトとの通信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("設定画面でメッセージを受信:", message);

  if (message.type === "settingsUpdated") {
    // 設定が更新された場合
    loadSettings();
  }

  sendResponse({ received: true });
});

// ページのアンロード時の処理
window.addEventListener("beforeunload", () => {
  console.log("設定画面がアンロードされます");
});

// エラーハンドリング
window.addEventListener("error", (event) => {
  console.error("設定画面でエラーが発生しました:", event.error);
  showStatus("エラーが発生しました", "error");
});

// 未処理のPromise拒否をキャッチ
window.addEventListener("unhandledrejection", (event) => {
  console.error("未処理のPromise拒否が発生しました:", event.reason);
  showStatus("エラーが発生しました", "error");
});
