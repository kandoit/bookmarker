chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-link',
    title: 'Save to Bookmarker',
    contexts: ['link'],
  })
  chrome.contextMenus.create({
    id: 'save-page',
    title: 'Save page to Bookmarker',
    contexts: ['page'],
  })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.menuItemId === 'save-link' ? info.linkUrl : tab?.url
  if (!url) return
  chrome.storage.local.set({ pendingUrl: url })
  chrome.action.openPopup?.()
})
