import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { getMyGovernmentId, submitGovernmentId, uploadGovernmentIdImage } from "../api/governmentId";
import type { GovernmentIdType } from "../api/types";
import { useAuth } from "../app/AuthContext";
import { ErrorMessage } from "../components/ErrorMessage";
import { FormField } from "../components/FormField";
import { Loading } from "../components/Loading";
import { BUTTON_PRIMARY, Card, CardTitle } from "../components/ui";
import { describeError } from "../lib/errors";
import { cleanGovernmentIdNumber, validateGovernmentIdImage, validateGovernmentIdNumber } from "../lib/validation";

/** Aadhaar is a two-sided card, so both sides are needed. A PAN card is used front-only. */
const ID_CHOICES: { value: GovernmentIdType; label: string; hint: string }[] = [
  { value: "aadhaar", label: "Aadhaar", hint: "12 digits. Front and back images needed." },
  { value: "pan", label: "PAN", hint: "Like ABCDE1234F. Front image only." },
];

function needsBackImage(idType: GovernmentIdType): boolean {
  return idType === "aadhaar";
}

/** One file picker with the chosen file's name, or a preview when the file is an image. */
function ImagePicker({
  label,
  file,
  errorMessage,
  onChoose,
}: {
  label: string;
  file: File | null;
  errorMessage: string | null;
  onChoose: (file: File | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // A preview URL has to be released again, so it is made in an effect and cleaned up when the
  // file changes or the page closes. A PDF gets no preview; its name is shown instead.
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <label className="block text-sm font-medium text-ink-2" htmlFor={`picker-${label}`}>
        {label}
      </label>
      <input
        id={`picker-${label}`}
        type="file"
        accept="image/png,image/jpeg,application/pdf"
        onChange={(event) => onChoose(event.target.files?.[0] ?? null)}
        aria-invalid={errorMessage ? true : undefined}
        className="field mt-1 block w-full file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink-2"
      />
      {previewUrl && (
        <img src={previewUrl} alt={`${label} preview`} className="mt-2 max-h-40 rounded-lg border border-line object-contain" />
      )}
      {file && !previewUrl && <p className="mt-1 text-sm text-ink-3">{file.name}</p>}
      {errorMessage && <p className="mt-1 text-sm text-bad">{errorMessage}</p>}
    </div>
  );
}

/**
 * The page at /government-id. Every employee submits one government ID here, once: Aadhaar
 * (both sides) or PAN (front only). Until it is saved, RequireLogin keeps them on this page and
 * the backend refuses every other endpoint. The moment it is saved the app opens in the same
 * session, with no second login.
 */
export function GovernmentIdPage() {
  const { session, markGovernmentIdSubmitted } = useAuth();
  const navigate = useNavigate();

  const [idType, setIdType] = useState<GovernmentIdType>("aadhaar");
  const [idNumber, setIdNumber] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [numberError, setNumberError] = useState<string | null>(null);
  const [frontError, setFrontError] = useState<string | null>(null);
  const [backError, setBackError] = useState<string | null>(null);

  // Only asked for when the page is opened by hand after submitting; the gate itself uses the session.
  const statusQuery = useQuery({
    queryKey: ["my-government-id", session?.employeeId],
    queryFn: () => getMyGovernmentId(session!.accessToken),
    enabled: Boolean(session),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const token = session!.accessToken;
      // The images go up first; each returns the path to send with the number.
      const front = await uploadGovernmentIdImage(token, "front", frontFile!);
      const back = needsBackImage(idType) ? await uploadGovernmentIdImage(token, "back", backFile!) : null;
      return submitGovernmentId(token, {
        id_type: idType,
        id_number: cleanGovernmentIdNumber(idType, idNumber),
        front_image_path: front.image_path,
        back_image_path: back ? back.image_path : null,
      });
    },
    onSuccess: () => {
      markGovernmentIdSubmitted();
      navigate("/home", { replace: true });
    },
  });

  function chooseIdType(nextType: GovernmentIdType) {
    setIdType(nextType);
    setNumberError(null);
    setBackError(null);
    if (!needsBackImage(nextType)) {
      setBackFile(null); // a PAN card has no back image to send
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const numberProblem = validateGovernmentIdNumber(idType, idNumber);
    const frontProblem = frontFile ? validateGovernmentIdImage(frontFile) : "Upload the front image of your ID.";
    const backProblem = !needsBackImage(idType)
      ? null
      : backFile
        ? validateGovernmentIdImage(backFile)
        : "Upload the back image of your Aadhaar.";

    setNumberError(numberProblem);
    setFrontError(frontProblem);
    setBackError(backProblem);
    if (numberProblem || frontProblem || backProblem) {
      return;
    }
    submitMutation.mutate();
  }

  if (statusQuery.isPending) {
    return <Loading label="Loading your ID details" />;
  }

  // Already on file: nothing to do here. Only the super admin can clear it.
  if (statusQuery.data?.submitted) {
    return (
      <div className="page page-narrow">
        <h1 className="page-title">Government ID</h1>
        <Card label="Government ID">
          <CardTitle>On file</CardTitle>
          <p className="text-sm text-ink-2">{statusQuery.data.masked_number}</p>
          <p className="mt-2 text-sm text-ink-3">
            Your ID is saved. It cannot be changed here. If it has to be corrected, ask the super admin to clear it,
            and you will be asked for a new one at your next login.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="page page-narrow">
      <h1 className="page-title">Government ID</h1>
      <form onSubmit={handleSubmit} noValidate>
        <Card label="Submit your government ID">
          <CardTitle>One more step</CardTitle>
          <p className="notice border-warn/30 bg-warn-soft text-warn">
            A government ID is required before you can use the app. Submit either your Aadhaar or your PAN. This is
            asked only once.
          </p>

          <fieldset className="mt-4">
            <legend className="block text-sm font-medium text-ink-2">Which ID are you submitting?</legend>
            <div className="mt-2 space-y-2">
              {ID_CHOICES.map((choice) => (
                <label
                  key={choice.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                    idType === choice.value ? "border-brand bg-surface-2" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="id-type"
                    value={choice.value}
                    checked={idType === choice.value}
                    onChange={() => chooseIdType(choice.value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-ink-1">{choice.label}</span>
                    <span className="block text-xs text-ink-3">{choice.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 space-y-4">
            <FormField
              label={idType === "aadhaar" ? "Aadhaar number" : "PAN number"}
              value={idNumber}
              onChange={(event) => setIdNumber(event.target.value)}
              errorMessage={numberError}
              inputMode={idType === "aadhaar" ? "numeric" : "text"}
              autoComplete="off"
              placeholder={idType === "aadhaar" ? "1234 5678 9012" : "ABCDE1234F"}
            />
            <ImagePicker
              label={idType === "aadhaar" ? "Aadhaar front image" : "PAN front image"}
              file={frontFile}
              errorMessage={frontError}
              onChoose={(file) => {
                setFrontFile(file);
                setFrontError(null);
              }}
            />
            {needsBackImage(idType) && (
              <ImagePicker
                label="Aadhaar back image"
                file={backFile}
                errorMessage={backError}
                onChoose={(file) => {
                  setBackFile(file);
                  setBackError(null);
                }}
              />
            )}
            <p className="text-xs text-ink-3">PNG, JPG or PDF, up to 5 MB each.</p>
          </div>

          {submitMutation.isError && <ErrorMessage message={describeError(submitMutation.error)} />}
          <button type="submit" disabled={submitMutation.isPending} className={`${BUTTON_PRIMARY} mt-4 w-full`}>
            {submitMutation.isPending ? "Saving..." : "Submit and continue"}
          </button>
        </Card>
      </form>
    </div>
  );
}
