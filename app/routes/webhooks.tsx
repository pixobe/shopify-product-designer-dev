import type { ActionFunction, LoaderFunction } from "react-router";

// Shopify CLI hits this endpoint to verify webhooks are reachable before delivering events.
export const loader: LoaderFunction = () => {
    console.log("Webhook verification ping received");
    return new Response(null, { status: 204 });
};


export const action: ActionFunction = async ({ request }) => {
    const rawBody = await request.text();

    console.log("🔔 Webhook headers:");
    console.log(Object.fromEntries(request.headers.entries()));

    console.log("📦 Webhook raw payload:");
    console.log(rawBody);

    // If JSON
    try {
        const json = JSON.parse(rawBody);
        console.log("✅ Parsed payload:", json);
    } catch {
        console.log("⚠️ Payload is not valid JSON");
    }

    return new Response("OK", { status: 200 });
};