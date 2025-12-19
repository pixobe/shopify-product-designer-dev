// GraphQL query to get current app installation plan and subscription details
const APP_NAME = "Colorgizer";

const GET_APP_INSTALLATION_PLAN = `
  query GetAppInstallationPlan {
    currentAppInstallation {
      activeSubscriptions {
        name
        status
        currentPeriodEnd
        lineItems {
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                }
              }
              ... on AppUsagePricing {
                cappedAmount {
                  amount
                }
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Determines the plan name from active subscriptions
 * Returns 'free' if no active subscriptions, otherwise returns subscription name or 'paid'
 */
function getPlanFromSubscriptions(
  activeSubscriptions:
    | Array<{
        name?: string;
        status?: string;
      }>
    | null
    | undefined,
): string {
  if (!activeSubscriptions || activeSubscriptions.length === 0) {
    return "Free";
  }
  // Return the first active subscription name if available
  const activeSubscription = activeSubscriptions.find(
    (sub) => sub.status === "ACTIVE" || sub.status === "PENDING",
  );
  return activeSubscription?.name || "Pro";
}

/**
 * Formats the expiry date from subscription's currentPeriodEnd
 */
function getExpiryFromSubscription(
  activeSubscriptions:
    | Array<{
        currentPeriodEnd?: string;
        status?: string;
      }>
    | null
    | undefined,
): string {
  if (!activeSubscriptions || activeSubscriptions.length === 0) {
    return "";
  }

  const activeSubscription = activeSubscriptions.find(
    (sub) => sub.status === "ACTIVE" || sub.status === "PENDING",
  );

  if (activeSubscription?.currentPeriodEnd) {
    // Format the date to ISO string or specific format
    return activeSubscription.currentPeriodEnd;
  }

  return new Date().toISOString().split("T")[0];
}

/**
 * Creates a SHA-256 digest from a message
 * @param message
 * @returns hex string of SHA-256 digest
 */
async function createDigest(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

/**
 *
 * @param admin
 * @returns
 */
export async function getAppSubscriptionDetails(
  admin: any,
  shop: string,
): Promise<{
  plan: string;
  expiry: string;
  digest: string;
  identifier: string;
}> {
  let plan = "Free";
  let expiry = new Date().toISOString().split("T")[0];
  let digest = "";
  try {
    const installationResponse = await admin.graphql(GET_APP_INSTALLATION_PLAN);
    const planData = await installationResponse.json();
    if (planData.data?.currentAppInstallation?.activeSubscriptions) {
      const activeSubscriptions =
        planData.data.currentAppInstallation.activeSubscriptions;
      plan = getPlanFromSubscriptions(activeSubscriptions);
      expiry = getExpiryFromSubscription(activeSubscriptions);
      digest = await createDigest(`${shop}${APP_NAME}${plan}${expiry}`);
    }
  } catch (error) {
    console.warn(
      "Failed to fetch app installation plan:",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
  return { plan, expiry, digest, identifier: shop };
}
