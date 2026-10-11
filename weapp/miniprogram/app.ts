import { registerPrivacyAuthorization } from './utils/privacy'

App<IAppOption>({
  globalData: {},
  onLaunch() { registerPrivacyAuthorization() },
})
