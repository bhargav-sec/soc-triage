import UploadForm from "./UploadForm";

export const metadata = { title: "Bulk Upload · SOC Triage" };

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <UploadForm />
      </div>
    </main>
  );
}