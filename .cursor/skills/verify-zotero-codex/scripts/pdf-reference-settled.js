// Read-only condition for control.mjs --capture-when after a PDF reference click.
const zotero = ChromeUtils.importESModule('chrome://zotero/content/zotero.mjs').Zotero;
const reader = zotero.Reader.getByTabID(Zotero_Tabs.selectedID);
const view = reader?._internalReader?._primaryView;
const find = reader?._internalReader?._state?.primaryViewFindState;
if (!view || !find) throw new Error('Open the fixture PDF reader first');
if (view._highlightedPosition || find.active || find.popupOpen || find.query ||
    view._findController?._highlightMatches) return false;
return {
  page: view._iframeWindow.PDFViewerApplication.pdfViewer.currentPageNumber,
  findActive: find.active,
  findPopupOpen: find.popupOpen,
  query: find.query,
  highlightMatches: Boolean(view._findController?._highlightMatches),
  highlightedPosition: view._highlightedPosition || null,
  annotationCount: zotero.Items.get(reader.itemID).getAnnotations().length,
};
