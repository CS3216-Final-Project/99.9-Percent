import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {useGame} from './store';
import {localCloudCopy,rememberCloud} from './cloud';
import {makeEnvelope,validateEnvelope} from './saveEnvelope';
import {loadGame,rawSave} from './persist';
import {newGame} from '../sim';
import * as api from '../lib/api';
vi.mock('../lib/api',async original=>{const actual=await original<typeof import('../lib/api')>();return {...actual,getSession:vi.fn(),listRuns:vi.fn(),getRun:vi.fn(),putRun:vi.fn(),logout:vi.fn()};});
const a={account:{id:'owner-a',displayName:'A'},csrfToken:'csrf-a'},b={account:{id:'owner-b',displayName:'B'},csrfToken:'csrf-b'};
beforeEach(()=>{localStorage.clear();useGame.setState(useGame.getInitialState(),true);vi.clearAllMocks();vi.mocked(api.getSession).mockResolvedValue(a);vi.mocked(api.logout).mockResolvedValue();useGame.getState().boot();useGame.getState().play();useGame.getState().onboardingMove('skip');});
afterEach(()=>vi.restoreAllMocks());
function current(){const s=useGame.getState();return makeEnvelope(s.game,s.remainderMs,1,s.measurement);}
it('restores an account once while pending without automatically attaching a guest',async()=>{
  let resolve!:(s:typeof a)=>void;vi.mocked(api.getSession).mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const pending=useGame.getState().restoreAccount();await useGame.getState().restoreAccount();resolve(a);await pending;
  expect(api.getSession).toHaveBeenCalledTimes(1);expect(api.putRun).not.toHaveBeenCalled();expect(localCloudCopy(current().runId)).toBeUndefined();
});
it('attaches only explicitly, retains identity, and saves with expected revision',async()=>{
  await useGame.getState().restoreAccount();const e=current();vi.mocked(api.putRun).mockResolvedValue({runId:e.runId,revision:1,envelope:e,updatedAt:'now'});
  await useGame.getState().saveCloud();expect(api.putRun).not.toHaveBeenCalled();
  await useGame.getState().saveCloud(true);expect(api.putRun).toHaveBeenCalledWith(expect.objectContaining({runId:e.runId}),0,a.csrfToken);
  expect(localCloudCopy(e.runId)?.ownerId).toBe(a.account.id);expect(useGame.getState().game.campaign!.runId).toBe(e.runId);
  vi.mocked(api.putRun).mockResolvedValue({runId:e.runId,revision:2,envelope:e,updatedAt:'later'});await useGame.getState().saveCloud();expect(api.putRun).toHaveBeenLastCalledWith(expect.anything(),1,a.csrfToken);
});
it('retains offline/expired-session changes and prevents attachment by the next account',async()=>{
  await useGame.getState().restoreAccount();const e=current();vi.mocked(api.putRun).mockRejectedValue(new api.AccountApiError(401,{error:'expired'}));
  await useGame.getState().saveCloud(true);expect(useGame.getState().accountSession).toBeNull();expect(localCloudCopy(e.runId)?.local.runId).toBe(e.runId);
  vi.mocked(api.getSession).mockResolvedValue(b);await useGame.getState().restoreAccount();vi.mocked(api.putRun).mockClear();
  await useGame.getState().saveCloud(true);expect(api.putRun).not.toHaveBeenCalled();expect(useGame.getState().cloudStatus).toContain('another account');
});
it('keeps a local snapshot queued when the network fails and retries the same revision',async()=>{
  await useGame.getState().restoreAccount();const e=current();vi.mocked(api.putRun).mockRejectedValueOnce(Error('offline'));
  await useGame.getState().saveCloud(true);expect(localCloudCopy(e.runId)?.revision).toBe(0);
  useGame.getState().advance();const local=current();expect(localCloudCopy(e.runId)?.local.inputs).toEqual(local.inputs);
  vi.mocked(api.putRun).mockResolvedValue({runId:e.runId,revision:1,envelope:local,updatedAt:'now'});await useGame.getState().saveCloud();
  expect(api.putRun).toHaveBeenLastCalledWith(expect.objectContaining({inputs:local.inputs,step:local.step}),0,a.csrfToken);
});
it('signs out without clearing any saves or owner bindings',async()=>{
  await useGame.getState().restoreAccount();const e=current();rememberCloud({ownerId:a.account.id,revision:2,local:e});localStorage.setItem('nn.save.v1','legacy');const bytes=rawSave();
  await useGame.getState().signOut();expect(rawSave()).toBe(bytes);expect(localStorage.getItem('nn.save.v1')).toBe('legacy');expect(localCloudCopy(e.runId)?.ownerId).toBe(a.account.id);
});
it('retains both conflict versions across reload and retries only after explicit choice',async()=>{
  await useGame.getState().restoreAccount();const e=current(),remote={runId:e.runId,revision:3,envelope:{...e,savedAt:4},updatedAt:'now'};
  vi.mocked(api.putRun).mockRejectedValueOnce(new api.AccountApiError(409,{error:'conflict',current:remote}));await useGame.getState().saveCloud(true);
  expect(localCloudCopy(e.runId)?.remote).toEqual(remote);await useGame.getState().saveCloud();expect(api.putRun).toHaveBeenCalledTimes(1);
  vi.mocked(api.putRun).mockResolvedValue({...remote,revision:4});await useGame.getState().keepLocalConflict();
  expect(api.putRun).toHaveBeenLastCalledWith(expect.anything(),3,a.csrfToken);expect(localStorage.getItem(`nn.campaign.conflict.${e.runId}.3`)).not.toBeNull();
});
it('resumes a validated cloud run paused while preserving the current local company',async()=>{
  await useGame.getState().restoreAccount();const previous=current(),e=makeEnvelope(newGame(8,'remote'),300);
  vi.mocked(api.getRun).mockResolvedValue({runId:e.runId,revision:2,envelope:e,updatedAt:'now'});await useGame.getState().resumeCloud(e.runId);
  expect(useGame.getState()).toMatchObject({started:false,running:false,remainderMs:300});expect(loadGame().status).toBe('ok');expect(validateEnvelope(e)).toMatchObject({status:"ok",game:useGame.getState().game});
  expect(localStorage.getItem(`nn.campaign.before-cloud.${previous.runId}.pending`)).not.toBeNull();
});
it('does not replace progress with unsupported cloud envelopes',async()=>{
  await useGame.getState().restoreAccount();const before=rawSave(),e=current();vi.mocked(api.getRun).mockResolvedValue({runId:e.runId,revision:1,envelope:{...e,schemaVersion:99 as 3},updatedAt:'now'});
  await useGame.getState().resumeCloud(e.runId);expect(rawSave()).toBe(before);expect(useGame.getState().cloudStatus).toContain('compatible');
});
it('loads schema 3 cloud replay saves paused and archives the original response without uploading',async()=>{
  await useGame.getState().restoreAccount();const e={...makeEnvelope(newGame(8,'phase3-remote'),321),schemaVersion:3 as const};
  const remote={runId:e.runId,revision:2,envelope:e,updatedAt:'now'};vi.mocked(api.getRun).mockResolvedValue(remote);
  await useGame.getState().resumeCloud(e.runId);
  expect(useGame.getState()).toMatchObject({started:false,running:false,remainderMs:321});
  expect(useGame.getState().game.campaign!.dataStage).toBeNull();expect(api.putRun).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(`nn.campaign.before-cloud.${e.runId}.cloud.2`)!)).toEqual(remote);
  expect(localCloudCopy(e.runId)?.local.schemaVersion).toBe(6);
});
it('reports corrupt schema 3 cloud inputs as incompatible while preserving local progress',async()=>{
  await useGame.getState().restoreAccount();const before=rawSave(),game=useGame.getState().game;
  const e={...current(),schemaVersion:3 as const,step:-1};vi.mocked(api.getRun).mockResolvedValue({runId:e.runId,revision:1,envelope:e,updatedAt:'now'});
  await useGame.getState().resumeCloud(e.runId);expect(rawSave()).toBe(before);expect(useGame.getState().game).toBe(game);
  expect(useGame.getState().cloudStatus).toBe('This cloud save needs a compatible game version. Local progress is retained.');
});
it('blocks replacement/attachment when account records are corrupt or storage fails',async()=>{
  await useGame.getState().restoreAccount();localStorage.setItem('nn.campaign.cloud.v1','{');await useGame.getState().saveCloud(true);
  expect(api.putRun).not.toHaveBeenCalled();expect(localStorage.getItem('nn.campaign.cloud.v1')).toBe('{');
  localStorage.removeItem('nn.campaign.cloud.v1');vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});
  await useGame.getState().saveCloud(true);expect(api.putRun).not.toHaveBeenCalled();
});
it('loads deployed replay-log source bytes without replacing them on read',()=>{
  const replay=JSON.stringify({schemaVersion:1,scenarioId:'opening-db',scenarioVersion:1,runId:'old',seed:1,step:0,inputs:[],runtime:{remainderMs:0},savedAt:1});
  localStorage.setItem('nn.campaign.save.v1',replay);expect(loadGame().status).toBe('ok');expect(rawSave()).toBe(replay);
  expect(localStorage.getItem('nn.campaign.save.v1.backup.v1')).toBeNull();
});
it('prevents sign-in navigation when local progress cannot be preserved',()=>{
  vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});expect(useGame.getState().prepareSignIn()).toBe(false);
});

it('prevents a new-company race while an upload is in flight',async()=>{
  await useGame.getState().restoreAccount();const e=current();let resolve!:(r:Awaited<ReturnType<typeof api.putRun>>)=>void;
  vi.mocked(api.putRun).mockImplementation(()=>new Promise(r=>{resolve=r;}));const pending=useGame.getState().saveCloud(true);
  useGame.getState().newRun();expect(current().runId).toBe(e.runId);
  resolve({runId:e.runId,revision:1,envelope:e,updatedAt:'now'});await pending;expect(localCloudCopy(e.runId)?.ownerId).toBe(a.account.id);
});
it('does not restore a stale session response after signing out',async()=>{
  await useGame.getState().restoreAccount();let resolve!:(s:typeof a)=>void;
  vi.mocked(api.getSession).mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const restoring=useGame.getState().restoreAccount();await useGame.getState().signOut();resolve(a);await restoring;
  expect(useGame.getState()).toMatchObject({accountStatus:'guest',accountSession:null});
});
it('checkpoints an attached company before importing a replacement',async()=>{
  await useGame.getState().restoreAccount();const previous=current();rememberCloud({ownerId:a.account.id,revision:2,local:previous});
  useGame.getState().advance();const latest=current();
  expect(useGame.getState().importSave(JSON.stringify(makeEnvelope(newGame(7,'imported'))))).toBe(true);
  expect(localCloudCopy(previous.runId)).toMatchObject({ownerId:a.account.id,revision:2,local:{step:latest.step}});
  expect(current().runId).toBe('imported');expect(localCloudCopy('imported')).toBeUndefined();
});
it('prevents mode switches and imports from rebinding an in-flight cloud upload',async()=>{
  await useGame.getState().restoreAccount();const e=current();let resolve!:(r:Awaited<ReturnType<typeof api.putRun>>)=>void;
  vi.mocked(api.putRun).mockImplementation(()=>new Promise(r=>{resolve=r;}));const pending=useGame.getState().saveCloud(true);
  expect(useGame.getState().switchMode('classic')).toBe(false);
  expect(useGame.getState().importSave(JSON.stringify(makeEnvelope(newGame(7,'replacement'))))).toBe(false);
  expect(current().runId).toBe(e.runId);
  resolve({runId:e.runId,revision:1,envelope:e,updatedAt:'now'});await pending;
  expect(localCloudCopy(e.runId)).toMatchObject({ownerId:a.account.id,revision:1,local:{runId:e.runId}});
  expect(localCloudCopy('replacement')).toBeUndefined();
});
it('keeps a quota-failed conflict in memory without an unhandled rejection',async()=>{
  await useGame.getState().restoreAccount();const e=current(),remote={runId:e.runId,revision:2,envelope:e,updatedAt:'now'};
  vi.mocked(api.putRun).mockImplementation(async()=>{vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('quota');});throw new api.AccountApiError(409,{error:'conflict',current:remote});});
  await expect(useGame.getState().saveCloud(true)).resolves.toBeUndefined();expect(useGame.getState().cloudConflict).toEqual(remote);expect(useGame.getState().cloudStatus).toContain('Keep this tab open');
});
