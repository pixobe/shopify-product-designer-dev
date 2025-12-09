import { authenticate } from "../shopify.server";

/**
 * Tiny helper to run Admin GraphQL and return the typed `data` object.
 * We don't rely on a top-level `errors` field; Shopify userErrors are read per-mutation.
 */
async function adminGraphQL<T>(
  admin: Awaited<ReturnType<typeof authenticate.public.appProxy>>["admin"],
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const resp = await admin!.graphql(query, { variables });
  const parsed = (await resp.json()) as { data: T };
  return parsed.data;
}

/**
 *
 * @param fileUrl
 */
/**
 * Fetches the CDN URL of a Shopify GenericFile given its GID.
 * Returns the URL string if found, otherwise null.
 */
export async function getFileUrl(
  admin: any,
  fileGid: string,
): Promise<string | null> {
  const query = `
    query getFileById($id: ID!) {
      node(id: $id) {
        ... on GenericFile {
          id
          url
          fileStatus
          mimeType
          alt
          createdAt
        }
      }
    }
  `;

  const res = await admin.graphql(query, { variables: { id: fileGid } });
  const { data } = await res.json();
  return data?.node?.url ?? null;
}

/**
 *
 * @returns
 */
export async function uploadFileToStaged(admin: any, file: any): Promise<any> {
  // ---- A) stagedUploadsCreate ------------------------------------------------
  type StagedUploadsCreateData = {
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string;
        resourceUrl: string;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  };

  const stagedData = await adminGraphQL<StagedUploadsCreateData>(
    admin,
    /* GraphQL */ `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      input: [
        {
          filename: file.name || "customization.json",
          mimeType: file.type || "application/json",
          httpMethod: "POST",
          resource: "FILE",
        },
      ],
    },
  );

  if (stagedData.stagedUploadsCreate.userErrors?.length) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "stagedUploadsCreate error",
        details: stagedData.stagedUploadsCreate.userErrors,
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const target = stagedData.stagedUploadsCreate.stagedTargets?.[0];
  if (!target) {
    return new Response(
      JSON.stringify({ ok: false, error: "No staged target returned" }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // ---- B) Upload the bytes (S3-style form) -----------------------------------
  const s3Form = new FormData();
  for (const p of target.parameters) s3Form.append(p.name, p.value);
  s3Form.append("file", file);

  const s3Resp = await fetch(target.url, { method: "POST", body: s3Form });
  if (!s3Resp.ok) {
    const text = await s3Resp.text();
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Staged file upload failed",
        details: text,
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }

  // ---- C) fileCreate (finalize as GenericFile) -------------------------------
  type FileCreateData = {
    fileCreate: {
      files: Array<{ id: string; fileStatus: string; url?: string }>;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  };

  const fileCreate = await adminGraphQL<FileCreateData>(
    admin,
    /* GraphQL */ `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            ... on GenericFile {
              url
              mimeType
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      files: [
        {
          contentType: "FILE",
          originalSource: target.resourceUrl,
          alt: "Customization JSON",
        },
      ],
    },
  );

  return fileCreate;
}

/**
 * Fetches the JSON data stored in each file reference (GenericFile GID)
 * @param admin The Shopify admin GraphQL client
 * @param fileGids Array of GenericFile GIDs
 * @returns Promise resolving to an array of JSON objects
 */
export async function getJsonDataFromFiles(
  admin: any,
  fileGids: string[],
): Promise<any[]> {
  const results: any[] = [];

  for (const gid of fileGids) {
    try {
      const url = await getFileUrl(admin, gid);
      if (!url) {
        console.warn(`No URL found for file ${gid}`);
        results.push(null);
        continue;
      }

      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`Failed to fetch ${url}: ${res.status}`);
        results.push(null);
        continue;
      }

      // Try parsing as JSON
      const jsonData = await res.json().catch(() => null);
      results.push(jsonData);
    } catch (err) {
      console.error("Error fetching file content:", gid, err);
      results.push(null);
    }
  }

  return results;
}
