// app/routes/apps.customizer.upload.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { uploadFileToStaged } from "../utils/staged-file";

const sanitizeCartId = (value: FormDataEntryValue | null): string | null => {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, "_");
    return sanitized || null;
};


export const action = async ({ request }: ActionFunctionArgs) => {
    // App Proxy auth (for storefront → app proxy calls)
    const ctx = await authenticate.public.appProxy(request);
    const admin = ctx?.admin;

    if (!admin) {
        return new Response(JSON.stringify({ ok: false, error: "No admin context" }), {
            status: 401,
            headers: { "content-type": "application/json" },
        });
    }

    // Accept either a Blob `file` or a string `json`
    const form = await request.formData();
    let file = form.get("file") as File | null;
    const jsonText = form.get("json") as string | null;
    const variantId = sanitizeCartId(form.get("variant_id"));
    const targetFileName = variantId ? `${variantId}_pixobe.json` : "customization.json";


    if (!file && jsonText) {
        file = new File([jsonText], targetFileName, { type: "application/json" });
    } else if (file && variantId) {
        const buffer = await file.arrayBuffer();
        file = new File([buffer], targetFileName, { type: file.type || "application/json" });
    }

    if (!file) {
        return new Response(JSON.stringify({ ok: false, error: "Missing `file` or `json` field" }), {
            status: 400,
            headers: { "content-type": "application/json" },
        });
    }

    const fileCreate = await uploadFileToStaged(admin, file);

    if (fileCreate.fileCreate.userErrors?.length) {
        return new Response(
            JSON.stringify({ ok: false, error: "fileCreate error", details: fileCreate.fileCreate.userErrors }),
            { status: 502, headers: { "content-type": "application/json" } }
        );
    }

    const created = fileCreate.fileCreate.files?.[0];
    if (!created?.id) {
        return new Response(JSON.stringify({ ok: false, error: "No file returned" }), {
            status: 502,
            headers: { "content-type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, fileGid: created.id, fileUrl: created.url ?? null }), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
};

// Optional: block GETs with 405 to make this clearly POST-only
export const loader = async (_args: LoaderFunctionArgs) =>
    new Response("Method Not Allowed", { status: 405 });
