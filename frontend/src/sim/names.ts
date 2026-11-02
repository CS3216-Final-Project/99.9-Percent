/** The name players see for an app server: its id `app-3` reads "Server 3". Other ids are returned unchanged. */
export function serverName(id: string): string {
  const n = /^app-(\d+)$/.exec(id)?.[1];
  return n ? `Server ${n}` : id;
}
