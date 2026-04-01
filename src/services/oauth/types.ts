export type SubscriptionType =
  | 'free'
  | 'pro'
  | 'max'
  | 'team'
  | 'enterprise'
  | 'api'
  | string

export type RateLimitTier = 'standard' | 'priority' | string

export type BillingType = 'subscription' | 'payg' | 'enterprise' | string

export type OAuthTokens = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scopes?: string[]
  subscriptionType?: SubscriptionType | null
  rateLimitTier?: RateLimitTier | null
  profile?: {
    account: {
      uuid: string
      email: string
      display_name?: string
      created_at?: string
    }
    organization: {
      uuid?: string
      has_extra_usage_enabled?: boolean
      billing_type?: BillingType | null
      subscription_created_at?: string
    }
  }
  tokenAccount?: {
    uuid: string
    emailAddress: string
    organizationUuid?: string
  }
}

export type OAuthTokenExchangeResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
}

export type OAuthProfileResponse = {
  account?: {
    uuid: string
    email: string
    display_name?: string
    created_at?: string
  }
  organization?: {
    uuid?: string
    has_extra_usage_enabled?: boolean
    billing_type?: BillingType | null
    subscription_created_at?: string
  }
  email?: string
  accountUuid?: string
  organizationUuid?: string
  organizationName?: string | null
  displayName?: string
  hasExtraUsageEnabled?: boolean
  billingType?: BillingType | null
  accountCreatedAt?: string
  subscriptionCreatedAt?: string
}

export type UserRolesResponse = {
  organizationRole?: string | null
  workspaceRole?: string | null
}
export type ReferralRedemptionsResponse = any;
export type ReferrerRewardInfo = any;
export type ReferralCampaign = any;
export type ReferralEligibilityResponse = any;
