# Nine-node technology tree

The playable tree follows proposal §7.5 with three branches of three upgrades:

| Capacity | Data | Reliability |
| --- | --- | --- |
| Scale Up | Larger Database | Health Checks |
| Scale Out + Load Balancing | Read Cache | Spare Application Instance |
| Autoscaling | Cache Tuning | Automatic Failover |

Scale Up and Scale Out are independent choices. Autoscaling requires load balancing.
Larger Database uses the existing repeatable database-tier upgrade action; it is
independent of Read Cache. Cache Tuning requires a deployed Read Cache. Automatic
Failover requires Health Checks, a spare application instance and load balancing.

Metrics, forecasts and alerts are baseline tools. Research still costs cash and
engineer-weeks, and built upgrades must be deployed through the existing release
flow. The nine-node reduction does not implement milestone research points or
replace the weekly simulation with the roadmap's shared step engine.

Read Cache warms over two weekly turns. Cache Tuning improves the maximum database
load reduction from 36% to 50% and warms a cold cache in one turn. The simplified
workload assumes 60% of database demand is cache-eligible; writes cannot be cached.
Application and database capacity remain independent. Automatic Failover promotes
a spare without increasing total application capacity, so overload can remain.

Promotions remain operational controls: Social push is available from the start,
Launch campaign at 5,000 users and Targeted campaign at 10,000 users. They do not
require research nodes. Growth and engineering research, database replicas and
backups are removed from the player-facing research tree.

Legacy definitions remain to resume existing completed upgrades, queued work,
releases and incident saves. A deployed legacy cache without warm-up state is
treated as already warm. Existing legacy equipment remains usable, but removed
research cannot be started again. Technology progress counts only the nine nodes.

The remaining roadmap work includes progressive node revelation, research points,
per-instance startup/routing delays and the replacement simulation/reliability
model. The current scene remains 3D and the original incident families remain.
