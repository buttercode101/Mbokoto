import { describe, expect, it } from "vitest";
import { putEvidenceBlob, getEvidenceBlob, deleteEvidenceBlob, wipeEvidenceBlobs } from "@/lib/evidence";

describe("evidence repository", () => {
  it("preserves original bytes and a content fingerprint", async () => {
    const file = new Blob(["original incident note"], { type: "text/plain" });
    const record = await putEvidenceBlob({ file, originalName: "incident.txt" });
    const loaded = await getEvidenceBlob(record.id);
    expect(loaded?.originalName).toBe("incident.txt");
    expect(loaded?.size).toBe(file.size);
    expect(loaded?.hash).toHaveLength(16);
    expect(new TextDecoder().decode(loaded?.bytes)).toBe("original incident note");
    await deleteEvidenceBlob(record.id);
  });

  it("supports emergency deletion of the evidence object store", async () => {
    await putEvidenceBlob({ file: new Blob(["wipe"]) });
    await wipeEvidenceBlobs();
    const loaded = await getEvidenceBlob("missing");
    expect(loaded).toBeNull();
  });
});
