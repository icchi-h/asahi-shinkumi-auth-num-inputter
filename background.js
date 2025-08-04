// バックグラウンドスクリプト（Service Worker）
console.log("Chrome拡張機能のバックグラウンドスクリプトが開始されました");

// 対象URLの定義
const TARGET_URL = "https://www.parasol.anser.ne.jp/ib/BLI001Dispatch";

// 拡張機能のインストール時の処理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 初回インストール時の処理
    initializeExtension();
  }
});

// 拡張機能の初期化
async function initializeExtension() {
  try {
    // デフォルト設定を保存
    await chrome.storage.sync.set({
      userNumber: "",
      autoExecute: false,
      lastUpdated: Date.now(),
    });

    console.log("拡張機能の初期化が完了しました");
  } catch (error) {
    console.error("拡張機能の初期化に失敗しました:", error);
  }
}

// メッセージリスナーの設定
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // メッセージタイプに応じた処理
  switch (message.type) {
    case "pageAction":
      handlePageAction(message.data, sender, sendResponse);
      break;
    case "getSettings":
      handleGetSettings(sendResponse);
      break;
    case "updateSettings":
      handleUpdateSettings(message.data, sendResponse);
      break;
    case "settingsUpdated":
      handleSettingsUpdated(message.data, sendResponse);
      break;
    case "getUserNumber":
      handleGetUserNumber(sendResponse);
      break;
    default:
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true; // 非同期レスポンスを示す
});

// ページアクションの処理
async function handlePageAction(data, sender, sendResponse) {
  try {
    // 対象URLかどうかをチェック
    if (!sender.tab?.url?.includes(TARGET_URL)) {
      sendResponse({ success: false, error: "対象外のURLです" });
      return;
    }

    // 利用者番号を取得
    const settings = await chrome.storage.sync.get(["userNumber"]);
    const userNumber = settings.userNumber || "未設定";

    // データを保存（利用者番号を含む）
    await chrome.storage.local.set({
      lastPageAction: {
        data: data,
        userNumber: userNumber,
        timestamp: Date.now(),
        tabId: sender.tab?.id,
        targetSite: true,
      },
    });

    sendResponse({
      success: true,
      message: "対象サイトでページアクションが処理されました",
      userNumber: userNumber,
    });
  } catch (error) {
    console.error("ページアクションの処理に失敗しました:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 設定の取得
async function handleGetSettings(sendResponse) {
  try {
    const result = await chrome.storage.sync.get([
      "userNumber",
      "autoExecute",
      "lastUpdated",
    ]);
    sendResponse({ success: true, data: result });
  } catch (error) {
    console.error("設定の取得に失敗しました:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 設定の更新
async function handleUpdateSettings(data, sendResponse) {
  try {
    await chrome.storage.sync.set({
      ...data,
      lastUpdated: Date.now(),
    });

    sendResponse({ success: true, message: "設定が更新されました" });
  } catch (error) {
    console.error("設定の更新に失敗しました:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 設定更新の処理
async function handleSettingsUpdated(data, sendResponse) {
  try {
    // 設定画面に統計情報の更新を通知
    chrome.runtime.sendMessage({
      type: "statsUpdated",
      data: data,
    });

    sendResponse({ success: true, message: "設定更新が処理されました" });
  } catch (error) {
    console.error("設定更新の処理に失敗しました:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// 利用者番号の取得
async function handleGetUserNumber(sendResponse) {
  try {
    const result = await chrome.storage.sync.get(["userNumber"]);
    const userNumber = result.userNumber || "";
    sendResponse({ success: true, userNumber: userNumber });
  } catch (error) {
    console.error("利用者番号の取得に失敗しました:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// タブの更新を監視
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // 対象URLかどうかをチェック
    if (tab.url.includes(TARGET_URL)) {
      // 自動実行設定を確認
      chrome.storage.sync.get(["autoExecute"], (result) => {
        if (result.autoExecute) {
          // コンテンツスクリプトに自動実行を通知
          chrome.tabs
            .sendMessage(tabId, {
              action: "autoExecute",
              data: { timestamp: Date.now() },
            })
            .catch((error) => {
              console.log("自動実行の通知に失敗しました:", error);
            });
        }
      });
    }
  }
});

// タブのアクティブ化を監視
chrome.tabs.onActivated.addListener((activeInfo) => {
  // アクティブになったタブのURLをチェック
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && tab.url.includes(TARGET_URL)) {
      // 対象サイトのタブがアクティブになった場合の処理
    }
  });
});

// 拡張機能のアイコンクリック時の処理
chrome.action.onClicked.addListener(async (tab) => {
  // 対象URLかどうかをチェック
  if (!tab.url?.includes(TARGET_URL)) {
    return;
  }

  // 対象サイトの場合、コンテンツスクリプトにメッセージを送信
  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: "iconClicked",
      data: { timestamp: Date.now() },
    });
  } catch (error) {
    console.error("アイコンクリックの処理に失敗しました:", error);
  }
});

// ストレージの変更を監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  // 設定の変更を他のコンポーネントに通知
  if (namespace === "sync") {
    if (changes.userNumber) {
      // すべてのタブを取得してから対象サイトをフィルタリング
      chrome.tabs.query({}, (tabs) => {
        if (tabs && Array.isArray(tabs)) {
          const targetTabs = tabs.filter(
            (tab) => tab.url && tab.url.includes(TARGET_URL)
          );

          targetTabs.forEach((tab) => {
            chrome.tabs
              .sendMessage(tab.id, {
                type: "userNumberUpdated",
                data: changes.userNumber.newValue,
              })
              .catch((error) => {
                console.log("利用者番号更新の通知に失敗しました:", error);
              });
          });
        }
      });
    }
  }
});

// 定期的な処理（必要に応じて）
// setInterval(() => {
//   console.log('定期的な処理を実行中...');
// }, 60000); // 1分ごと

// エラーハンドリング
chrome.runtime.onSuspend.addListener(() => {
  console.log("Service Workerが停止されます");
});

// 未処理のエラーをキャッチ
self.addEventListener("error", (event) => {
  console.error("Service Workerでエラーが発生しました:", event.error);
});

self.addEventListener("unhandledrejection", (event) => {
  console.error("未処理のPromise拒否が発生しました:", event.reason);
});
