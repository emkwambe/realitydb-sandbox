import { useState } from 'react';

type TabId = 'psql' | 'python' | 'dbeaver' | 'rstudio' | 'tableau' | 'loadsql';

interface Props {
  connectionString?: string;
  fileName?: string;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'psql', label: 'psql' },
  { id: 'python', label: 'Python / Jupyter' },
  { id: 'dbeaver', label: 'DBeaver' },
  { id: 'rstudio', label: 'R Studio' },
  { id: 'tableau', label: 'Tableau' },
  { id: 'loadsql', label: 'Load SQL File' },
];

function getSnippet(tab: TabId, cs: string, file: string): string {
  switch (tab) {
    case 'psql':
      return cs
        ? `psql "${cs}"`
        : `psql -h localhost -U postgres -d mydb -f ${file}`;
    case 'python':
      return cs
        ? `import pandas as pd\nfrom sqlalchemy import create_engine\n\nengine = create_engine("${cs}")\ndf = pd.read_sql("SELECT * FROM accounts LIMIT 10", engine)\ndf.head()`
        : `import pandas as pd\nfrom sqlalchemy import create_engine\n\n# Load the downloaded SQL file into a local PostgreSQL database first:\n# psql -h localhost -U postgres -d mydb -f ${file}\n\nengine = create_engine("postgresql://postgres:password@localhost/mydb")\ndf = pd.read_sql("SELECT * FROM accounts LIMIT 10", engine)\ndf.head()`;
    case 'dbeaver':
      return cs
        ? `Connection URL: ${cs}\n\nOr parse:\n  Host: (from URL)\n  Port: 5432\n  Database: neondb\n  User: (from URL)\n  Password: (from URL)`
        : `1. Create a new PostgreSQL connection\n2. Import the SQL file:\n   Database > Execute SQL Script > Select ${file}\n3. Browse tables in the Database Navigator`;
    case 'rstudio':
      return cs
        ? `library(DBI)\nlibrary(RPostgres)\n\ncon <- dbConnect(Postgres(),\n  host = "(from connection string)",\n  dbname = "neondb",\n  user = "(from connection string)",\n  password = "(from connection string)",\n  port = 5432\n)\n\ndbListTables(con)\ndf <- dbReadTable(con, "accounts")\nhead(df)`
        : `# First load SQL into local PostgreSQL:\n# psql -h localhost -U postgres -d mydb -f ${file}\n\nlibrary(DBI)\nlibrary(RPostgres)\n\ncon <- dbConnect(Postgres(),\n  host = "localhost",\n  dbname = "mydb",\n  user = "postgres",\n  password = "password",\n  port = 5432\n)\n\ndbListTables(con)\ndf <- dbReadTable(con, "accounts")\nhead(df)`;
    case 'tableau':
      return cs
        ? `Server: (host from connection string)\nPort: 5432\nDatabase: neondb\nAuthentication: Username and Password\nUsername: (from connection string)\nPassword: (from connection string)\n\nRequires Tableau Desktop with PostgreSQL connector.`
        : `1. Load SQL into local PostgreSQL first\n2. In Tableau: Connect > PostgreSQL\n   Server: localhost\n   Port: 5432\n   Database: mydb\n   Username: postgres`;
    case 'loadsql':
      return `# Load the SQL file into a local PostgreSQL database:\npsql -h localhost -U postgres -d mydb -f ${file || 'realitydb-banking-5k.sql'}\n\n# Or create a fresh database first:\ncreatedb mydb\npsql -h localhost -U postgres -d mydb -f ${file || 'realitydb-banking-5k.sql'}\n\n# Verify:\npsql -h localhost -U postgres -d mydb -c "\\dt"`;
    default:
      return '';
  }
}

export function ConnectionSnippets({ connectionString, fileName }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>(connectionString ? 'psql' : 'loadsql');
  const [copied, setCopied] = useState(false);

  const snippet = getSnippet(activeTab, connectionString || '', fileName || 'realitydb-dataset.sql');

  const handleCopy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-[var(--border)] bg-bg-card rounded-lg overflow-hidden">
      <div className="flex border-b border-[var(--border)] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-[10px] font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-accent border-b-2 border-accent bg-accent/5'
                : 'text-[var(--muted)] hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="p-3 text-[10px] font-mono text-[var(--muted)] overflow-x-auto whitespace-pre-wrap max-h-48">
          {snippet}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 text-[9px] text-accent bg-bg-elevated px-2 py-0.5 rounded border border-[var(--border)] hover:bg-accent/10"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
