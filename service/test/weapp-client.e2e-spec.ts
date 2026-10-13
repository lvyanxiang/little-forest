import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import { transpileModule, ModuleKind, ScriptTarget } from 'typescript';

const initSql = readFileSync(resolve(__dirname, '../init/init.sql'), 'utf8');
const seededText = JSON.parse(initSql.match(/\$ui\$([\s\S]*?)\$ui\$/)![1]);
const serverStore = {
  name: 'Server store', address: 'Server address', closedWeekdays: [],
  noticeHeading: 'Server notice', noticeItems: ['Server rule'], noticeFoot: 'Server foot',
  homeHeroText: 'Server hero', homeHeroImageUrl: '/api/store/home-image',
  brandLogoUrl: '/api/store/brand-image', successNoticeLines: ['Server success'],
  quickDateDays: 14, bookingAdvanceDays: 90, uiText: seededText,
};

// Exercise the actual mini program modules and page handlers with native WeChat callbacks.
function client() {
  const storage = new Map<string, unknown>();
  const requests: any[] = [];
  const logins: any[] = [];
  const uploads: any[] = [];
  const downloads: any[] = [];
  const modals: any[] = [];
  const contracts: any[] = [];
  const pages = new Map<string, any>();
  const componentDefinitions = new Map<string, any>();
  const dialogs = new WeakMap<object, any>();
  let activePage: any;
  let autoStore = true;
  const wx = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    request: (options: any) => {
      if (autoStore && options.url.endsWith('/store')) {
        options.success({ statusCode: 200, data: structuredClone(serverStore) });
      } else requests.push(options);
    },
    login: (options: any) => logins.push(options),
    uploadFile: (options: any) => uploads.push(options),
    downloadFile: (options: any) => downloads.push(options),
    showModal: (options: any) => modals.push(options),
    showToast: jest.fn(),
    openPrivacyContract: (options: any) => contracts.push(options),
    pageScrollTo: jest.fn(),
    setNavigationBarTitle: jest.fn(),
    nextTick: (callback: () => void) => callback(),
    vibrateShort: jest.fn(),
    canIUse: () => true,
  };
  const modules = new Map<string, any>();
  const root = resolve(__dirname, '../../weapp/miniprogram');
  function load(file: string): any {
    const filename = resolve(root, file.endsWith('.ts') ? file : `${file}.ts`);
    if (filename === resolve(root, 'utils/config.ts')) return { API_BASE: 'https://example.com/api', resolveApiAsset: (value: string) => value ? new URL(value, 'https://example.com').href : '' };
    if (modules.has(filename)) return modules.get(filename).exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const source = transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2020 },
    }).outputText;
    runInNewContext(source, {
      module, exports: module.exports, wx, console: { error: jest.fn() },
      require: (name: string) => load(resolve(dirname(filename), name)),
      Page: (definition: any) => {
        definition.data = structuredClone(definition.data);
        definition.setData = (patch: any) => Object.assign(definition.data, patch);
        definition.selectComponent = () => dialog(definition);
        pages.set(filename, definition);
      },
      Component: (definition: any) => componentDefinitions.set(filename, definition),
      getCurrentPages: () => activePage ? [activePage] : [], setTimeout, clearTimeout,
    }, { filename });
    return module.exports;
  }
  const session = load('utils/session');
  function signIn(id = 'a', nickname = '书友', hasAvatar = false) {
    const value = { token: `token-${id}`, expiresAt: new Date(Date.now() + 60000).toISOString(), user: { id, nickname, hasAvatar, isDefaultNickname: nickname === seededText.defaultNickname } };
    session.saveSession(value);
    return value;
  }
  function page(name: string) {
    const file = `pages/${name}/${name}.ts`;
    load(file);
    activePage = pages.get(resolve(root, file));
    activePage.setData({ uiText: seededText, storeReady: true, storeLoading: false, quickDateDays: 14, bookingAdvanceDays: 90 });
    return activePage;
  }
  function dialog(owner = activePage) {
    if (dialogs.has(owner)) return dialogs.get(owner);
    const file = 'components/login-consent/index.ts';
    load(file);
    const definition = componentDefinitions.get(resolve(root, file));
    const instance = { ...definition.methods, data: structuredClone(definition.data),
      properties: { uiText: seededText },
      setData(patch: any) { Object.assign(this.data, patch); },
      triggerEvent(_name: string, detail: any) { owner.onLoginConsentVisibility({ detail }); },
      pageLifetimes: definition.pageLifetimes, lifetimes: definition.lifetimes,
    };
    dialogs.set(owner, instance);
    return instance;
  }
  async function agreeLogin() {
    const consent = dialog();
    const open = consent.onOpenPrivacy();
    contracts[contracts.length - 1].success({});
    await open;
    consent.onToggle();
    consent.onAgree();
    await flush();
  }
  return { load, signIn, session, page, dialog, agreeLogin, wx, requests, logins, uploads, downloads, modals, contracts, manualStore: () => { autoStore = false; } };
}

async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

function booking(id: string) {
  return { id, date: '2030-01-08', slotId: 1, slotLabel: '14:00 – 15:30', name: '书友', phone: '13800000000', people: 1, status: 'confirmed' };
}

describe('Mini program WeChat booking flow', () => {
  it('deduplicates configuration requests and never invents business defaults after a cold-start failure', async () => {
    const c = client();
    c.manualStore();
    const store = c.load('utils/store');
    const first = store.fetchStore();
    expect(store.fetchStore()).toBe(first);
    const rejected = expect(first).rejects.toThrow();
    expect(c.requests).toHaveLength(1);
    c.requests[0].fail({ errMsg: 'request:fail timeout' });
    await rejected;
    expect(store.getStore()).toBeNull();
    const page = c.page('home');
    page.setData({ storeReady: false });
    const load = page.loadStore();
    c.requests[1].fail({ errMsg: 'request:fail timeout' });
    await load;
    expect(page.data.heroImage).toBe('');
    expect(page.data.heroLines).toEqual([]);
    expect(page.data.showEntryNotice).toBe(false);
    expect(page.data.storeError).toContain('重试');
  });

  it('renders changed server copy and assets rather than packaged fallback content', async () => {
    const c = client();
    c.manualStore();
    const page = c.page('home');
    page.setData({ storeReady: false });
    const load = page.loadStore();
    c.requests[0].success({ statusCode: 200, data: { ...serverStore, homeHeroText: 'Changed line\nSecond line', uiText: { ...seededText, homeNoticeIntro: 'Changed notice' } } });
    await load;
    expect(page.data).toMatchObject({ storeReady: true, heroLines: ['Changed line', 'Second line'], heroImage: 'https://example.com/api/store/home-image', uiText: { homeNoticeIntro: 'Changed notice' } });
  });

  it('uses server date counts and clears old consent when booking purposes change', async () => {
    const c = client();
    const page = c.page('reserve');
    const settings = { ...serverStore, quickDateDays: 3, bookingAdvanceDays: 5 };
    page.applyStore(settings);
    const refresh = page.refreshPick();
    c.requests[0].success({ statusCode: 200, data: { closed: false, slots: [] } });
    await refresh;
    expect(page.data.quickDates).toHaveLength(3);
    expect(page.data.bookingAdvanceDays).toBe(5);
    page.setData({ name: '小林', phone: '13800000000', noticeRead: true, privacyAgreed: true, canSubmit: true });
    page.applyStore({ ...settings, uiText: { ...settings.uiText, bookingPurposeText: 'Changed data purpose' } });
    expect(page.data).toMatchObject({ noticeRead: true, privacyAgreed: false, canSubmit: false });
  });
  it('requires an explicit checkbox but does not require opening the privacy contract', async () => {
    const c = client();
    c.page('profile');
    const auth = c.load('utils/auth');
    const attempt = auth.loginWechat();
    const rejected = expect(attempt).rejects.toThrow('微信登录失败');
    const consent = c.dialog();
    expect(consent.data).toMatchObject({ show: true, checked: false });
    consent.onAgree();
    expect(consent.data.consentShake).toBe(true);
    expect(consent.data.errorText).toContain('请勾选');
    expect(c.logins).toHaveLength(0);
    consent.onToggle();
    consent.onAgree();
    await flush();
    expect(c.contracts).toHaveLength(0);
    expect(c.logins).toHaveLength(1);
    c.logins[0].fail({});
    await rejected;
  });

  it('allows consent after the optional contract viewer fails and still waits for a checkbox', async () => {
    const c = client();
    c.page('profile');
    const attempt = c.load('utils/auth').loginWechat();
    const failed = expect(attempt).rejects.toThrow('微信登录失败');
    const consent = c.dialog();
    const open = consent.onOpenPrivacy();
    c.contracts[0].fail({});
    await open;
    consent.onAgree();
    expect(c.logins).toHaveLength(0);
    consent.onToggle();
    consent.onAgree();
    await flush();
    expect(c.logins).toHaveLength(1);
    c.logins[0].fail({});
    await failed;
  });

  it('starts unchecked on retry and cancels login when leaving or unloading the page', async () => {
    const c = client();
    const page = c.page('profile');
    const auth = c.load('utils/auth');
    const first = auth.loginWechat();
    const rejected = expect(first).rejects.toThrow('已取消微信登录');
    const consent = c.dialog();
    consent.onToggle();
    consent.pageLifetimes.hide.call(consent);
    await rejected;
    const second = auth.loginWechat();
    const unloaded = expect(second).rejects.toThrow('已取消微信登录');
    expect(consent.data).toMatchObject({ show: true, checked: false });
    page.onUnload();
    await unloaded;
    expect(c.logins).toHaveLength(0);
    expect(c.requests).toHaveLength(0);
  });

  it('keeps the consent dialog while opening the official contract and waits for the checkbox', async () => {
    const c = client();
    c.page('reserve');
    const auth = c.load('utils/auth');
    const attempt = auth.loginWechat();
    const rejected = expect(attempt).rejects.toThrow('已取消微信登录');
    const consent = c.dialog();
    const open = consent.onOpenPrivacy();
    consent.pageLifetimes.hide.call(consent);
    c.contracts[0].success({});
    await open;
    consent.pageLifetimes.show.call(consent);
    consent.onAgree();
    await flush();
    expect(consent.data).toMatchObject({ show: true, checked: false });
    expect(consent.data).toMatchObject({ consentShake: true });
    expect(consent.data.errorText).toContain('请勾选');
    expect(c.logins).toHaveLength(0);
    consent.cancel();
    await rejected;
  });

  it('deduplicates concurrent logins and saves the returned user', async () => {
    const c = client();
    c.page('profile');
    const auth = c.load('utils/auth');
    const first = auth.loginWechat();
    expect(auth.loginWechat()).toBe(first);
    expect(c.logins).toHaveLength(0);
    await c.agreeLogin();
    expect(c.logins).toHaveLength(1);
    c.logins[0].success({ code: 'wechat-code' });
    await flush();
    expect(c.requests[0].data).toEqual({ code: 'wechat-code' });
    const value = { token: 'user-token', expiresAt: new Date(Date.now() + 60000).toISOString(), user: { id: 'a', nickname: '小林', hasAvatar: false } };
    c.requests[0].success({ statusCode: 201, data: value });
    await expect(first).resolves.toEqual(value);
    expect(c.session.getSession().user.nickname).toBe('小林');
  });

  it('relogs in after a rejected session, while network errors preserve the session', async () => {
    const c = client();
    c.page('reserve');
    const auth = c.load('utils/auth');
    c.signIn();
    const expired = auth.ensureWechatLogin(true);
    c.requests[0].success({ statusCode: 401, data: { message: '登录已过期' } });
    await flush();
    expect(c.dialog().data.show).toBe(true);
    await c.agreeLogin();
    c.logins[0].success({ code: 'new-code' });
    await flush();
    const next = c.signIn('a', '小林');
    c.requests[1].success({ statusCode: 201, data: next });
    await expect(expired).resolves.toEqual(next);
    const offline = auth.ensureWechatLogin(true);
    c.requests[2].fail({ errMsg: 'request:fail timeout' });
    await expect(offline).rejects.toThrow('暂时连不上服务');
    expect(c.dialog().data.show).toBe(false);
    expect(c.contracts).toHaveLength(1);
    expect(c.session.getSession().token).toBe(next.token);
  });

  it('does not restore a cancelled login after logout', async () => {
    const c = client();
    c.page('profile');
    const auth = c.load('utils/auth');
    const pending = auth.loginWechat();
    await c.agreeLogin();
    c.logins[0].success({ code: 'code' });
    await flush();
    await auth.logoutWechat();
    c.requests[0].success({ statusCode: 201, data: { token: 'old', user: { id: 'a' } } });
    await expect(pending).rejects.toThrow('登录已取消');
    expect(c.session.getSession()).toBeNull();
  });

  it('never overwrites a new account with an old avatar or clears it on a late upload 401', async () => {
    const c = client();
    const auth = c.load('utils/auth');
    c.signIn('a', '用户 A', true);
    const profile = auth.fetchWechatProfile();
    c.requests[0].success({ statusCode: 200, data: { id: 'a', nickname: '用户 A', hasAvatar: true } });
    await flush();
    c.signIn('b', '用户 B');
    c.downloads[0].success({ statusCode: 200, tempFilePath: 'avatar-a' });
    await expect(profile).rejects.toThrow('登录状态已变化');
    expect(c.session.getSession().user.id).toBe('b');
    c.signIn('a');
    const upload = auth.saveWechatProfile('用户 A', 'avatar-a');
    c.signIn('b', '用户 B');
    c.uploads[0].success({ statusCode: 401, data: JSON.stringify({ message: 'expired' }) });
    await expect(upload).rejects.toThrow('登录状态已变化');
    expect(c.session.getSession().user.id).toBe('b');
  });

  it('clears cached bookings across accounts and preserves new bookings after a late old response', async () => {
    const c = client();
    const api = c.load('utils/booking');
    c.signIn('a');
    const initial = api.fetchMyBookings();
    c.requests[0].success({ statusCode: 200, data: [booking('booking-a')] });
    await initial;
    expect(api.getBookings()[0].id).toBe('booking-a');
    const old = api.fetchMyBookings();
    c.signIn('b');
    expect(api.getBookings()).toEqual([]);
    const current = api.fetchMyBookings();
    c.requests[2].success({ statusCode: 200, data: [booking('booking-b')] });
    await current;
    c.requests[1].success({ statusCode: 200, data: [booking('booking-a')] });
    await expect(old).rejects.toThrow('登录状态已变化');
    expect(api.getBookings()[0].id).toBe('booking-b');
  });

  it('does not send a booking for a different account after the login check', async () => {
    const c = client();
    const api = c.load('utils/booking');
    c.signIn('a');
    const create = api.createBooking({ visitDate: '2030-01-08', slotId: 1, name: '用户 A', phone: '13800000000' });
    c.signIn('b');
    await expect(create).rejects.toThrow('登录状态已变化');
    expect(c.requests).toHaveLength(0);
  });

  it('verifies login before entering the form and prefills the nickname without carrying another account phone', async () => {
    const c = client();
    c.signIn('b', '小林');
    const page = c.page('reserve');
    page.setData({ selectedSlot: 1, rawSlots: [{ id: 1, isFull: false, isPast: false }], formUserId: 'a', name: '用户 A', phone: '13800000000', noticeRead: true, privacyAgreed: true });
    const next = page.onNext();
    expect(page.data.step).toBe('pick');
    c.requests[0].success({ statusCode: 200, data: { id: 'b', nickname: '小林', hasAvatar: false } });
    await next;
    expect(page.data).toMatchObject({ step: 'form', name: '小林', phone: '', noticeRead: false, privacyAgreed: false, formUserId: 'b', enteringForm: false });
    expect(page.isFieldsReady('小林', '123')).toBe(false);
    expect(page.isFieldsReady('小林', '13800000000')).toBe(true);
  });

  it('keeps the slot selection when login is cancelled and prevents duplicate login prompts', async () => {
    const c = client();
    const page = c.page('reserve');
    page.setData({ selectedSlot: 1, rawSlots: [{ id: 1, isFull: false, isPast: false }] });
    const next = page.onNext();
    await page.onNext();
    expect(c.dialog().data).toMatchObject({ show: true, checked: false });
    c.dialog().cancel();
    await next;
    expect(page.data).toMatchObject({ step: 'pick', selectedSlot: 1, enteringForm: false });
    expect(c.logins).toHaveLength(0);
    expect(c.requests).toHaveLength(0);
  });

  it('waits for nickname review and allows a corrected nickname to be saved', async () => {
    const c = client();
    c.signIn();
    const page = c.page('profile');
    page.onNicknameInput({ detail: { value: '新昵称' } });
    await page.onSaveProfile();
    expect(c.requests).toHaveLength(0);
    expect(page.data.profileError).toContain('正在审核');
    page.onNicknameReview({ detail: { pass: false } });
    page.onNicknameInput({ detail: { value: '小森林书友' } });
    page.onNicknameReview({ detail: { pass: true } });
    const save = page.onSaveProfile();
    expect(c.requests[0].data).toEqual({ nickname: '小森林书友' });
    c.requests[0].success({ statusCode: 201, data: { id: 'a', nickname: '小森林书友', hasAvatar: false } });
    await save;
    expect(page.data).toMatchObject({ displayName: '小森林书友', showProfileEditor: false, savingProfile: false });
  });

  it('does not submit contact information until the separate booking privacy consent is checked', async () => {
    const c = client();
    c.signIn();
    const page = c.page('reserve');
    page.setData({ step: 'form', selectedSlot: 1, formUserId: 'a', name: '小林', phone: '13800000000', noticeRead: true });
    await page.onConfirm();
    expect(c.requests).toHaveLength(0);
    expect(c.wx.pageScrollTo).toHaveBeenCalledWith(expect.objectContaining({ selector: '#privacy-check' }));
    page.onTogglePrivacy();
    expect(page.data.canSubmit).toBe(true);
    page.onTogglePrivacy();
    expect(page.data.canSubmit).toBe(false);
    await page.onConfirm();
    expect(c.requests).toHaveLength(0);
    page.onTogglePrivacy();
    const submit = page.onConfirm();
    await flush();
    expect(c.requests[0].data).toMatchObject({ name: '小林', phone: '13800000000' });
    c.requests[0].success({ statusCode: 201, data: booking('new-booking') });
    await submit;
    expect(page.data.step).toBe('success');
    page.onReset();
    expect(page.data).toMatchObject({ noticeRead: false, privacyAgreed: false, canSubmit: false });
  });

  it('saves an avatar without requiring a nickname and restores the database avatar on a later load', async () => {
    const c = client();
    c.signIn();
    const page = c.page('profile');
    page.openProfileEditor();
    page.onChooseAvatar({ detail: { avatarUrl: 'chosen-avatar' } });
    const save = page.onSaveProfile();
    expect(c.uploads[0].formData).toEqual({});
    const profile = { id: 'a', nickname: '书友', isDefaultNickname: true, hasAvatar: true, updatedAt: '2026-10-13T08:00:00.000Z' };
    c.uploads[0].success({ statusCode: 201, data: JSON.stringify(profile) });
    await flush();
    expect(c.downloads[0].url).toContain('?v=2026-10-13');
    expect(c.downloads[0].header.Authorization).toBe('Bearer token-a');
    c.downloads[0].fail({ errMsg: 'downloadFile:fail' });
    await save;
    expect(page.data).toMatchObject({ avatarUrl: 'chosen-avatar', avatarLoadFailed: true, showProfileEditor: false, savingProfile: false });
    const retry = page.onRetryAvatar();
    c.requests[0].success({ statusCode: 200, data: profile });
    await flush();
    c.downloads[1].success({ statusCode: 200, tempFilePath: 'avatar-from-database' });
    await retry;
    expect(page.data).toMatchObject({ avatarUrl: 'avatar-from-database', avatarLoadFailed: false, retryingAvatar: false });
    expect(c.session.getSession().user.avatarUrl).toBe('avatar-from-database');
  });

  it('preserves an existing avatar on transient download failures and keeps a newer save over stale reads', async () => {
    const c = client();
    const auth = c.load('utils/auth');
    const session = c.signIn('a', '小林', true);
    Object.assign(session.user, { avatarUrl: 'previous-avatar' });
    const first = auth.fetchWechatProfile();
    c.requests[0].success({ statusCode: 200, data: { id: 'a', nickname: '小林', hasAvatar: true, updatedAt: 'old-version' } });
    await flush();
    c.downloads[0].fail({});
    await expect(first).resolves.toMatchObject({ avatarUrl: 'previous-avatar', avatarLoadFailed: true });
    const stale = auth.fetchWechatProfile();
    c.requests[1].success({ statusCode: 200, data: { id: 'a', nickname: '小林', hasAvatar: true, updatedAt: 'old-version' } });
    await flush();
    const save = auth.saveWechatProfile(undefined, 'new-avatar');
    c.uploads[0].success({ statusCode: 201, data: JSON.stringify({ id: 'a', nickname: '小林', hasAvatar: true, updatedAt: 'new-version' }) });
    await flush();
    c.downloads[2].success({ statusCode: 200, tempFilePath: 'new-database-avatar' });
    await save;
    c.downloads[1].success({ statusCode: 200, tempFilePath: 'stale-avatar' });
    await expect(stale).resolves.toMatchObject({ avatarUrl: 'new-database-avatar' });
    expect(c.session.getSession().user.updatedAt).toBe('new-version');
  });

  it('offers WeChat phone authorization after login and fills only the current form', async () => {
    const c = client();
    c.signIn();
    const page = c.page('reserve');
    page.setData({ selectedSlot: 1, rawSlots: [{ id: 1, isFull: false, isPast: false }] });
    const next = page.onNext();
    c.requests[0].success({ statusCode: 200, data: { id: 'a', nickname: '小林', hasAvatar: false } });
    await next;
    expect(page.data).toMatchObject({ step: 'form', showPhonePrompt: true, phone: '' });
    expect(c.requests).toHaveLength(1);
    const phone = page.onGetPhoneNumber({ detail: { code: 'phone-code' } });
    await page.onGetPhoneNumber({ detail: { code: 'duplicate-code' } });
    expect(c.requests).toHaveLength(2);
    expect(c.requests[1].data).toEqual({ code: 'phone-code' });
    expect(c.requests[1].header.Authorization).toBe('Bearer token-a');
    c.requests[1].success({ statusCode: 201, data: { phoneNumber: '13800000000' } });
    await phone;
    expect(page.data).toMatchObject({ phone: '13800000000', fieldsReady: true, canSubmit: false, showPhonePrompt: false, gettingPhone: false });
  });

  it('allows manual phone entry when authorization is declined or unavailable', async () => {
    const c = client();
    c.signIn();
    const page = c.page('reserve');
    page.setData({ step: 'form', formUserId: 'a', showPhonePrompt: true });
    await page.onGetPhoneNumber({ detail: { errMsg: 'getPhoneNumber:fail user deny' } });
    expect(c.requests).toHaveLength(0);
    expect(page.data).toMatchObject({ showPhonePrompt: false, gettingPhone: false, phone: '' });
    const phone = page.onGetPhoneNumber({ detail: { code: 'phone-code' } });
    c.requests[0].success({ statusCode: 503, data: { message: '微信手机号能力尚未开通，请手动填写' } });
    await phone;
    expect(c.session.getSession().user.id).toBe('a');
    expect(page.data.phoneError).toContain('手动填写');
    page.onPhoneInput({ detail: { value: '13900000000' } });
    expect(page.data).toMatchObject({ phone: '13900000000', phoneError: '' });
  });

  it('does not overwrite edited phone numbers or carry late authorization across accounts', async () => {
    const c = client();
    c.signIn();
    const page = c.page('reserve');
    page.setData({ step: 'form', formUserId: 'a' });
    const first = page.onGetPhoneNumber({ detail: { code: 'phone-code' } });
    page.onPhoneInput({ detail: { value: '13900000000' } });
    c.requests[0].success({ statusCode: 201, data: { phoneNumber: '13800000000' } });
    await first;
    expect(page.data.phone).toBe('13900000000');
    const second = page.onGetPhoneNumber({ detail: { code: 'another-code' } });
    c.signIn('b');
    page.setData({ formUserId: 'b', phone: '' });
    c.requests[1].success({ statusCode: 201, data: { phoneNumber: '13800000000' } });
    await second;
    expect(page.data.phone).toBe('');
    expect(c.session.getSession().user.id).toBe('b');
  });
});
