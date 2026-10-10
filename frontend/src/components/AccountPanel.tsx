import {useEffect} from 'react';
import {useGame} from '@/game/store';
import {exportCloudCopies,localCloudCopy} from '@/game/cloud';
export function AccountPanel() {
  const s=useGame();
  useEffect(()=>{if(useGame.getState().accountStatus==='unchecked')void useGame.getState().restoreAccount();},[]);
  let owner:string|undefined,hasConflict=false,ownershipError=false;
  try {const copy=localCloudCopy(s.game.campaign!.runId);owner=copy?.ownerId;hasConflict=!!copy?.remote;}catch{ownershipError=true;}
  const mismatch=!!owner&&owner!==s.accountSession?.account.id;
  const exportCopies=()=>{try {const bytes=JSON.stringify({copies:JSON.parse(exportCloudCopies()),pendingConflict:s.cloudConflict,localCompany:s.game});const url=URL.createObjectURL(new Blob([bytes],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='account-local-copies.json';a.click();URL.revokeObjectURL(url);}catch{s.notify('Browser storage could not be read for export. Keep this tab open.','error');}};
  return <section aria-label="Account and cloud saves">
    <details><summary>Account and cloud saves</summary><p role="status">{s.cloudStatus}</p>
    {s.accountSession?<><p>Signed in as {s.accountSession.account.displayName}</p>
      <button className="btn" disabled={s.cloudBusy} onClick={()=>void s.signOut()}>Sign out</button>
      <button className="btn" disabled={s.cloudBusy} onClick={()=>void s.refreshCloudRuns()}>Refresh cloud companies</button>
      {s.hasRun&&<button className="btn" disabled={s.cloudBusy||mismatch||ownershipError||s.saveBlocked||hasConflict} onClick={()=>void s.saveCloud(!owner)}>{owner?'Save company to cloud':'Attach current guest company'}</button>}
      {mismatch&&<p>This local company belongs to another account. Sign in as its owner, or start a new guest company. Its pending progress remains local.</p>}
      {s.cloudRuns.map(run=><p key={run.runId}>{run.runId} · revision {run.revision} <button className="btn" disabled={s.cloudBusy} onClick={()=>void s.resumeCloud(run.runId)}>Resume cloud company {run.runId}</button></p>)}
      {hasConflict&&<><p>Choose explicitly: keep local progress in the cloud, or load the cloud version. Both versions will be retained.</p>
        <button className="btn" disabled={s.cloudBusy} onClick={()=>void s.keepLocalConflict()}>Keep local version in cloud</button>
        <button className="btn" disabled={s.cloudBusy} onClick={()=>void s.resumeCloud(s.game.campaign!.runId)}>Use cloud version</button></>}
    </>:<><a className="btn" href="/api/auth/google" onClick={e=>{if(!s.prepareSignIn())e.preventDefault();}}>Sign in with Google</a><button className="btn" disabled={s.accountStatus==='checking'} onClick={()=>void s.restoreAccount()}>Retry account connection</button></>}
    {ownershipError&&<p role="alert">Account ownership records could not be read. Export them before replacing any data.</p>}
    <button className="btn" onClick={exportCopies}>Export account copies</button>
  </details></section>;
}
