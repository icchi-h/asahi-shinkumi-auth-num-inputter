// DOM要素の参照（初期化時に設定）
let userNumberDisplay;
let openOptionsButton;
let extractDigitsButton;
let status;

// 初期化
document.addEventListener("DOMContentLoaded", async () => {
  // DOM要素の取得
  userNumberDisplay = document.getElementById("userNumberDisplay");
  openOptionsButton = document.getElementById("openOptionsButton");
  extractDigitsButton = document.getElementById("extractDigitsButton");
  status = document.getElementById("status");

  // 利用者番号を表示
  await loadUserNumber();

  // イベントリスナーの設定
  setupEventListeners();
});

// イベントリスナーの設定
function setupEventListeners() {
  // 桁数抽出ボタンのクリックイベント
  extractDigitsButton.addEventListener("click", async () => {
    try {
      setStatus("桁数抽出中...", "loading");

      // 現在のタブを取得
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tabs || tabs.length === 0) {
        setStatus("タブが見つかりませんでした", "error");
        return;
      }

      const tab = tabs[0];

      // 対象サイトかどうかをチェック
      if (!tab.url || !tab.url.includes("parasol.anser.ne.jp")) {
        setStatus(
          "対象サイトではありません。対象サイトにアクセスしてください。",
          "error"
        );
        return;
      }

      // コンテンツスクリプトに桁数抽出メッセージを送信
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "extractDigits",
        data: { timestamp: Date.now() },
      });

      if (response && response.success) {
        if (response.digits && response.digits.length > 0) {
          // 最初の4文字のみを表示
          const maxDigits = 4;
          const displayDigits = response.digits.slice(0, maxDigits);
          setStatus(`桁数抽出完了: ${displayDigits.join(", ")}桁目`, "success");
        } else {
          setStatus("桁数が見つかりませんでした", "error");
        }
      } else {
        setStatus("桁数抽出に失敗しました", "error");
      }
    } catch (error) {
      console.error("桁数抽出でエラーが発生しました:", error);

      if (error.message.includes("Receiving end does not exist")) {
        setStatus(
          "対象サイトでコンテンツスクリプトが実行されていません。ページを再読み込みしてください。",
          "error"
        );
      } else {
        setStatus("桁数抽出でエラーが発生しました: " + error.message, "error");
      }
    }
  });

  // アクティブフォームペーストボタンのクリックイベント
  const pasteToFormButton = document.getElementById("pasteToFormButton");
  if (pasteToFormButton) {
    pasteToFormButton.addEventListener("click", async () => {
      try {
        setStatus("アクティブフォームにペースト中...", "loading");

        // 現在のタブを取得
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (!tabs || tabs.length === 0) {
          setStatus("タブが見つかりませんでした", "error");
          return;
        }

        const tab = tabs[0];

        // 対象サイトかどうかをチェック
        if (!tab.url || !tab.url.includes("parasol.anser.ne.jp")) {
          setStatus(
            "対象サイトではありません。対象サイトにアクセスしてください。",
            "error"
          );
          return;
        }

        // コンテンツスクリプトにペーストメッセージを送信
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: "pasteToActiveForm",
          data: { timestamp: Date.now() },
        });

        if (response && response.success) {
          if (response.result && response.result.success) {
            setStatus(`ペースト完了: ${response.result.text}`, "success");
          } else {
            setStatus(
              response.result?.message || "ペーストに失敗しました",
              "error"
            );
          }
        } else {
          setStatus("ペーストに失敗しました", "error");
        }
      } catch (error) {
        console.error(
          "アクティブフォームペーストでエラーが発生しました:",
          error
        );

        if (error.message.includes("Receiving end does not exist")) {
          setStatus(
            "対象サイトでコンテンツスクリプトが実行されていません。ページを再読み込みしてください。",
            "error"
          );
        } else {
          setStatus(
            "アクティブフォームペーストでエラーが発生しました: " +
              error.message,
            "error"
          );
        }
      }
    });
  }

  // 設定画面を開くボタンのクリックイベント
  openOptionsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
}

// 利用者番号の読み込みと表示
async function loadUserNumber() {
  try {
    const result = await chrome.storage.sync.get(["userNumber"]);
    const userNumber = result.userNumber || "未設定";
    userNumberDisplay.textContent = `利用者番号: ${userNumber}`;
  } catch (error) {
    console.error("利用者番号の読み込みに失敗しました:", error);
    userNumberDisplay.textContent = "利用者番号: エラー";
  }
}

// ステータスの更新
function setStatus(message, type = "success") {
  if (!status) {
    console.error("status要素が見つかりません");
    return;
  }

  status.textContent = message;
  status.className = "status";

  if (type === "error") {
    status.classList.add("error");
  } else if (type === "loading") {
    status.classList.add("loading");
  }

  // 3秒後にステータスをリセット
  if (type !== "loading") {
    setTimeout(() => {
      if (status) {
        status.textContent = "準備完了";
        status.className = "status";
      }
    }, 3000);
  }
}

// バックグラウンドスクリプトとの通信
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("ポップアップでメッセージを受信:", message);

  if (message.type === "statusUpdate") {
    setStatus(message.data, message.status);
  } else if (message.type === "userNumberUpdated") {
    // 利用者番号が更新された場合
    loadUserNumber();
  }

  sendResponse({ received: true });
});

// ストレージの変更を監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.userNumber) {
    console.log("利用者番号が変更されました:", changes.userNumber);
    loadUserNumber();
  }
});
