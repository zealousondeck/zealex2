import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShieldCheck, Upload, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/kyc")({
  component: KycPage,
});

type Kyc = {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  address: string;
  id_type: string;
  id_number: string;
  id_document_path: string | null;
  selfie_path: string | null;
  proof_of_address_path: string | null;
  status: string;
  review_notes: string | null;
  created_at: string;
};

function useMyKyc() {
  return useQuery({
    queryKey: ["kyc", "me"],
    queryFn: async (): Promise<Kyc | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as Kyc) ?? null;
    },
  });
}

function KycPage() {
  const { data: isAdmin } = useIsAdmin();
  const { data: kyc, isLoading } = useMyKyc();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-soft text-foreground">
          <ShieldCheck className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Identity Verification</h1>
          <p className="text-sm text-muted-foreground">
            Verify your identity to unlock higher limits.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      ) : kyc ? (
        <StatusCard kyc={kyc} />
      ) : (
        <KycForm />
      )}

      {kyc && kyc.status === "rejected" && <KycForm resubmit />}

      {isAdmin && <AdminKycQueue />}
    </div>
  );
}

function StatusCard({ kyc }: { kyc: Kyc }) {
  const map = {
    pending: {
      icon: Clock,
      color: "bg-gold-soft text-foreground",
      label: "Under review",
      msg: "We're reviewing your documents. This usually takes 1–24 hours.",
    },
    approved: {
      icon: CheckCircle2,
      color: "bg-success/10 text-success",
      label: "Verified",
      msg: "You're fully verified. All exchange limits are unlocked.",
    },
    rejected: {
      icon: XCircle,
      color: "bg-destructive/10 text-destructive",
      label: "Needs attention",
      msg: kyc.review_notes ?? "Your submission was rejected. Please resubmit.",
    },
  } as const;
  const s = map[(kyc.status as keyof typeof map) ?? "pending"] ?? map.pending;
  const Icon = s.icon;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-10 w-10 place-items-center rounded-xl", s.color)}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-bold">{s.label}</p>
          <p className="text-sm text-muted-foreground">{s.msg}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Field label="Full name" value={kyc.full_name} />
            <Field label="ID type" value={kyc.id_type} />
            <Field label="Date of birth" value={kyc.date_of_birth} />
            <Field label="ID number" value={kyc.id_number} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function KycForm({ resubmit = false }: { resubmit?: boolean }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [idType, setIdType] = useState("nin");
  const [idNumber, setIdNumber] = useState("");
  const [idDoc, setIdDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function uploadOne(file: File, uid: string, kind: string): Promise<string> {
    const path = `${uid}/${kind}-${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file, {
      upsert: true,
      cacheControl: "3600",
    });
    if (error) throw error;
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !dob || !address || !idNumber || !idDoc || !selfie) {
      toast.error("Please fill all fields and upload ID + selfie");
      return;
    }
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const [idPath, selfiePath, proofPath] = await Promise.all([
        uploadOne(idDoc, uid, "id"),
        uploadOne(selfie, uid, "selfie"),
        proof ? uploadOne(proof, uid, "address") : Promise.resolve(null),
      ]);

      const { error } = await supabase.from("kyc_submissions").insert({
        user_id: uid,
        full_name: fullName,
        date_of_birth: dob,
        address,
        id_type: idType,
        id_number: idNumber,
        id_document_path: idPath,
        selfie_path: selfiePath,
        proof_of_address_path: proofPath,
        status: "pending",
      });
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: uid,
        title: "KYC submitted",
        body: "Your identity verification is under review.",
        category: "kyc",
      });
      queryClient.invalidateQueries({ queryKey: ["kyc", "me"] });
      toast.success("KYC submitted for review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-2xl border border-border bg-card p-5"
    >
      {resubmit && (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          Please resubmit your documents.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fn">Full legal name</Label>
          <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dob">Date of birth</Label>
          <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="addr">Residential address</Label>
          <Textarea id="addr" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>ID type</Label>
          <Select value={idType} onValueChange={setIdType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nin">National ID (NIN)</SelectItem>
              <SelectItem value="passport">Passport</SelectItem>
              <SelectItem value="drivers_license">Driver's License</SelectItem>
              <SelectItem value="voters_card">Voter's Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="idn">ID number</Label>
          <Input id="idn" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={40} />
        </div>
      </div>

      <FileField label="Upload ID document" file={idDoc} onChange={setIdDoc} />
      <FileField label="Selfie holding your ID" file={selfie} onChange={setSelfie} />
      <FileField label="Proof of address (optional)" file={proof} onChange={setProof} optional />

      <Button type="submit" variant="gold" className="w-full font-bold" disabled={submitting}>
        {submitting ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
        ) : (
          "Submit for verification"
        )}
      </Button>
    </form>
  );
}

function FileField({
  label,
  file,
  onChange,
  optional,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}{optional && <span className="text-muted-foreground"> (optional)</span>}</Label>
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-border bg-background p-4 hover:border-gold">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm">
            {file ? file.name : "Click to upload (PNG, JPG, PDF · max 5MB)"}
          </span>
        </div>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && f.size > 5 * 1024 * 1024) {
              toast.error("File too large (max 5MB)");
              return;
            }
            onChange(f ?? null);
          }}
        />
      </label>
    </div>
  );
}

function AdminKycQueue() {
  const queryClient = useQueryClient();
  const [active, setActive] = useState<Kyc | null>(null);
  const { data } = useQuery({
    queryKey: ["kyc", "queue"],
    queryFn: async () => {
      const { data } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Kyc[];
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Admin · KYC queue
      </h2>
      <ul className="divide-y divide-border">
        {(data ?? []).map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{k.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {k.id_type.toUpperCase()} · {k.id_number} ·{" "}
                <span className="uppercase">{k.status}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setActive(k)}>
                Review
              </Button>
            </div>
          </li>
        ))}
        {(data ?? []).length === 0 && (
          <p className="py-4 text-sm text-muted-foreground">No pending submissions.</p>
        )}
      </ul>
      {active && (
        <AdminReviewDialog
          submission={active}
          onClose={() => setActive(null)}
          onDone={() => {
            setActive(null);
            queryClient.invalidateQueries({ queryKey: ["kyc"] });
          }}
        />
      )}
    </div>
  );
}

function AdminReviewDialog({
  submission,
  onClose,
  onDone,
}: {
  submission: Kyc;
  onClose: () => void;
  onDone: () => void;
}) {
  const [notes, setNotes] = useState(submission.review_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<{ id?: string; selfie?: string; proof?: string }>({});

  useEffect(() => {
    let cancelled = false;
    async function sign(path: string | null) {
      if (!path) return undefined;
      const { data } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(path, 600);
      return data?.signedUrl;
    }
    (async () => {
      const [id, selfie, proof] = await Promise.all([
        sign(submission.id_document_path),
        sign(submission.selfie_path),
        sign(submission.proof_of_address_path),
      ]);
      if (!cancelled) setUrls({ id, selfie, proof });
    })();
    return () => {
      cancelled = true;
    };
  }, [submission]);

  async function decide(status: "approved" | "rejected") {
    if (status === "rejected" && !notes.trim()) {
      toast.error("Add reviewer notes explaining the rejection");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("kyc_submissions")
        .update({
          status,
          review_notes: notes.trim() || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: submission.user_id,
        title: status === "approved" ? "KYC approved" : "KYC needs attention",
        body:
          status === "approved"
            ? "Your identity was verified. All limits unlocked."
            : `Your KYC was rejected: ${notes.trim() || "please resubmit"}`,
        category: "kyc",
      });
      toast.success(`Marked ${status}`);
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h3 className="font-bold">Review KYC · {submission.full_name}</h3>
            <p className="text-xs text-muted-foreground">
              Submitted {new Date(submission.created_at).toLocaleString()} · Status{" "}
              <span className="uppercase">{submission.status}</span>
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="grid gap-5 p-5 md:grid-cols-2">
          <div className="space-y-3 text-sm">
            <Field label="Full name" value={submission.full_name} />
            <Field label="Date of birth" value={submission.date_of_birth} />
            <Field label="Address" value={submission.address} />
            <Field label="ID type" value={submission.id_type} />
            <Field label="ID number" value={submission.id_number} />
          </div>
          <div className="space-y-3">
            <DocumentPreview label="ID document" url={urls.id} />
            <DocumentPreview label="Selfie" url={urls.selfie} />
            <DocumentPreview label="Proof of address" url={urls.proof} />
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-5">
          <Label htmlFor="rn">Reviewer notes</Label>
          <Textarea
            id="rn"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Required when rejecting — shared with the user."
            maxLength={400}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => decide("rejected")} disabled={busy}>
              Reject
            </Button>
            <Button variant="gold" onClick={() => decide("approved")} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocumentPreview({ label, url }: { label: string; url?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-gold hover:underline"
          >
            Open
          </a>
        )}
      </div>
      {!url ? (
        <p className="text-xs text-muted-foreground">Not provided</p>
      ) : /\.pdf(\?|$)/i.test(url) ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-lg bg-secondary p-4 text-center text-sm font-semibold"
        >
          View PDF
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt={label}
            className="max-h-56 w-full rounded-lg object-contain"
          />
        </a>
      )}
    </div>
  );
}
