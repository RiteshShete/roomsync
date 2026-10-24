/**
 * All user-facing strings live here (PLAN rule: centralise copy). Voice: friendly, calm, clear;
 * never blame a roommate; never claim a capability that does not exist (no payments sent, no sync,
 * no push). Strings marked [spec] are quoted from spec §8/§10/§16.
 */
export const copy = {
  brand: { name: 'RoomSync', tagline: 'Shared living, simplified.' }, // [spec §1]

  welcome: {
    headline: 'Shared living, simplified.', // [spec §8.1]
    support: 'Keep shared expenses, chores, groceries, and house updates in one place.', // [spec §8.1]
    getStarted: 'Get started',
    haveInvite: 'I have an invite',
    haveAccount: 'I already have an account',
    inviteHint: 'Create your account first, then you can join with your invite code.',
  },

  auth: {
    signUpTitle: 'Create your account',
    logInTitle: 'Welcome back',
    forgotTitle: 'Reset your password',
    resetTitle: 'Choose a new password',
    displayName: 'Your name',
    displayNameHint: 'Your housemates will see this.',
    email: 'Email',
    password: 'Password',
    passwordHint: 'At least 8 characters.',
    confirmPassword: 'Confirm password',
    newPassword: 'New password',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    createAccount: 'Create account',
    creatingAccount: 'Creating account…',
    logIn: 'Log in',
    loggingIn: 'Logging in…',
    sendReset: 'Send reset link',
    sendingReset: 'Sending…',
    updatePassword: 'Update password',
    updatingPassword: 'Updating…',
    forgotLink: 'Forgot password?',
    haveAccount: 'Already have an account?',
    noAccount: 'New to RoomSync?',
    backToLogIn: 'Back to log in',
    signOut: 'Sign out',
    checkEmailTitle: 'Check your email',
    checkEmailBody: 'We sent a confirmation link. Open it to finish creating your account.',
    resetSentTitle: 'Check your email',
    resetSentBody: 'If an account exists for that email, a reset link is on its way.',
    resetInvalidTitle: 'This reset link is no longer valid',
    resetInvalidBody: 'Reset links work once and expire. Ask for a new one.',
    passwordUpdated: 'Password updated.',
  },

  validation: {
    nameRequired: 'Enter your name.',
    nameTooLong: 'Use 60 characters or fewer.',
    emailRequired: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address, like name@example.com.',
    passwordRequired: 'Enter a password.',
    passwordShort: 'Use at least 8 characters.',
    confirmRequired: 'Type the password again.',
    confirmMismatch: 'The passwords don’t match.',
    amountInvalid: 'Enter an amount like 1,250.50.',
  },

  household: {
    chooseTitle: 'Set up your household',
    chooseBody: 'Create a new household, or join one with an invite code.',
    create: 'Create a household',
    createBody: 'Start fresh and invite your roommates.',
    join: 'Join a household',
    joinBody: 'Enter the code a housemate shared with you.',
    notYet: 'Household setup arrives in the next update.',
  },

  nav: {
    label: 'Main',
    home: 'Home',
    expenses: 'Expenses',
    chores: 'Chores',
    house: 'House',
    you: 'You',
  },

  header: {
    notifications: 'Notifications',
    notificationsUnavailable: 'The activity centre arrives in a later update.',
    back: 'Back',
    close: 'Close',
    dismiss: 'Dismiss',
  },

  placeholder: {
    title: 'Coming soon',
    body: 'This part of RoomSync is still being built. It will show up here in a later update.',
  },

  you: { signedInAs: 'Signed in as', appearance: 'Your account' },

  states: {
    loading: 'Loading…',
    errorTitle: 'Something went wrong',
    retry: 'Try again',
    reload: 'Reload RoomSync',
  },

  // [spec §10, §16]
  errors: {
    generic: 'Something went wrong. Please try again.',
    save: 'We couldn’t save that change. Your information is still here—please try again.',
    permission: 'You don’t have permission to make this change.',
    inviteInvalid: 'This invite link is no longer valid. Ask a household member for a new one.',
    notFound: 'We couldn’t find that. It may have been removed.',
    conflict: 'Someone else changed this just now. Refresh to see the latest, then try again.',
    network: 'We couldn’t reach RoomSync. Check your connection and try again.',
    householdArchived: 'This household is archived, so changes are turned off. The owner can restore it.',
    ownerMustTransfer: 'Transfer ownership to another member before leaving.',
    soleMember: 'You’re the only member, so you can archive the household instead of leaving.',
    currencyLocked: 'The currency can’t change once an expense or settlement exists.',
    laterOccurrenceCompleted: 'A later occurrence of this chore is already done, so this one can’t be reopened.',
    invalidCredentials: 'That email and password don’t match. Check them and try again.',
    emailTaken: 'There’s already an account with that email. Try logging in instead.',
    weakPassword: 'Choose a stronger password with at least 8 characters.',
    rateLimited: 'Too many tries. Wait a few minutes and try again.',
    invite: {
      not_found: 'This invite link is no longer valid. Ask a household member for a new one.',
      revoked: 'That invite was cancelled. Ask a household member for a new one.',
      expired: 'That invite has expired. Ask a household member for a new one.',
      used_up: 'That invite has already been used. Ask a household member for a new one.',
      household_archived: 'That household is archived, so it can’t take new members.',
      household_full: 'That household is full.',
      throttled: 'Too many tries. Wait a little while before entering another code.',
    } as Record<string, string>,
  },

  // Honest wording: nothing is saved or synced while offline (spec's "may not be synced" implies sync).
  offline: 'You’re offline. Changes you make now won’t be saved.',

  env: {
    title: 'RoomSync isn’t configured',
    body: 'This build is missing the settings it needs to reach its database.',
    fix: 'Copy .env.example to .env.local, fill in the values from `npx supabase status`, then restart the dev server.',
    secretKey:
      'The key provided looks like a secret key. Only the publishable key may be used in the app. Remove the secret key and use the publishable one.',
  },
} as const;
