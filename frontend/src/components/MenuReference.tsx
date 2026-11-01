import "./MenuReference.css";

/** Each piece of equipment in the building, and the AWS service that does the same job. */
const SERVICES: readonly [equipment: string, service: string][] = [
  ["Network", "Application Load Balancer"],
  ["Servers", "Amazon EC2, scaled by EC2 Auto Scaling"],
  ["Read Cache", "Amazon ElastiCache"],
  ["Database", "Amazon RDS"],
  ["Monitoring wall", "Amazon CloudWatch"],
];

const DIAGRAM = "/aws-reference.svg";

/** The menu's AWS tab: a player reference that maps the building's machines onto real AWS services. */
export function MenuReference() {
  return (
    <section className="menu-reference" aria-label="Your machines on AWS">
      <p className="muted">The machines in your building do the same jobs as these AWS services. Requests flow left to right; dashed lines are metrics and controls.</p>
      <figure>
        <a href={DIAGRAM} target="_blank" rel="noreferrer" aria-label="Open the AWS diagram full size in a new tab">
          <img src={DIAGRAM} width={1560} height={800} loading="lazy" decoding="async" alt="Users send requests to Network, an Application Load Balancer, which shares traffic across Servers 1 to 3 on Amazon EC2. EC2 Auto Scaling adds and removes servers. Servers look up reads in the Read Cache, Amazon ElastiCache, and send writes and cache misses to the Database, Amazon RDS. Every machine reports service metrics to the Monitoring wall, Amazon CloudWatch." />
        </a>
      </figure>
      <dl className="menu-reference-list">
        {SERVICES.map(([equipment, service]) => (
          <div key={equipment}><dt>{equipment}</dt><dd>{service}</dd></div>
        ))}
      </dl>
    </section>
  );
}
