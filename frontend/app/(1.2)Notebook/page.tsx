import NotebookView from "@/app/Notebook_Components/NotebookView";

/*
 * The route file stays thin on purpose: everything the Notebook is made of
 * lives in app/Notebook_Components/, so it can be reworked without touching
 * routing.
 */
export default function NotebookPage() {
  return <NotebookView />;
}
