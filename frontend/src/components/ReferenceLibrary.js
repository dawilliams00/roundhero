import React, { useMemo, useState } from 'react';

function getDoc(docs, docId) {
  return docs.find(doc => doc.id === docId) || docs[0] || null;
}

function getPage(doc, pageNumber) {
  if (!doc?.pages?.length) return null;
  return doc.pages.find(page => Number(page.page) === Number(pageNumber)) || doc.pages[0];
}

function blockText(block) {
  if (!block) return '';
  if (block.type === 'table') return (block.rows || []).flat().join(' ');
  return block.text || '';
}

function rowText(row) {
  if (!row) return '';
  return [row.roll, row.effect, row.save].filter(Boolean).join(' ');
}

function matchesQuery(value, query) {
  return !query || String(value || '').toLowerCase().includes(query.toLowerCase());
}

function TableBlock({ rows }) {
  if (!rows?.length) return null;
  const [head, ...body] = rows;
  return (
    <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)',margin:'8px 0 12px'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr>
            {head.map((cell, idx) => (
              <th key={idx} style={{textAlign:'left',padding:'7px 8px',borderBottom:'1px solid var(--border)',background:'var(--bg-secondary)',color:'var(--accent-light)',fontWeight:900}}>
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx} style={{verticalAlign:'top',padding:'7px 8px',borderTop:rowIdx ? '1px solid var(--border)' : 0,color:'var(--text-secondary)',lineHeight:1.45}}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ block }) {
  if (block.type === 'heading') {
    return <h3 style={{color:'var(--accent-light)',fontSize:14,margin:'12px 0 6px'}}>{block.text}</h3>;
  }
  if (block.type === 'table') {
    return <TableBlock rows={block.rows || []} />;
  }
  return (
    <p style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.55,whiteSpace:'pre-wrap',margin:'0 0 10px'}}>
      {block.text}
    </p>
  );
}

function ReboundTable({ doc, query }) {
  const rows = (doc?.rows || []).filter(row => matchesQuery(rowText(row), query));
  return (
    <div style={{display:'grid',gap:8}}>
      {(doc?.intro || []).map((line, idx) => (
        <p key={idx} style={{color:'var(--text-secondary)',fontSize:13,lineHeight:1.45,margin:0}}>{line}</p>
      ))}
      <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr>
              {['Roll', 'Effect', 'Save'].map(label => (
                <th key={label} style={{textAlign:'left',padding:'8px',background:'var(--bg-secondary)',color:'var(--accent-light)',fontWeight:900}}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.roll}-${idx}`}>
                <td style={{padding:'8px',borderTop:'1px solid var(--border)',color:row.roll?.includes('[+]') ? 'var(--success)' : 'var(--warning)',fontWeight:900,whiteSpace:'nowrap'}}>
                  {row.roll}
                </td>
                <td style={{padding:'8px',borderTop:'1px solid var(--border)',color:'var(--text-secondary)',lineHeight:1.45}}>
                  {row.effect}
                </td>
                <td style={{padding:'8px',borderTop:'1px solid var(--border)',color:'var(--text-dim)',whiteSpace:'nowrap'}}>
                  {row.save || 'None'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReferenceLibraryContent({ docsPayload, initialDocId = 'codex_mechanics', initialPage = 1 }) {
  const docs = docsPayload?.docs || [];
  const [docId, setDocId] = useState(initialDocId);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [query, setQuery] = useState('');
  const doc = getDoc(docs, docId);
  const pages = doc?.pages || [];
  const visiblePages = useMemo(() => {
    if (!query || doc?.kind === 'table') return pages;
    return pages.filter(page => matchesQuery(page.search_text, query));
  }, [doc, pages, query]);
  const selectedPage = getPage(doc, pageNumber);
  const page = visiblePages.find(row => Number(row.page) === Number(selectedPage?.page)) || visiblePages[0] || selectedPage;
  const blocks = (page?.blocks || []).filter(block => matchesQuery(blockText(block), query) || !query);

  if (!docs.length) {
    return <div style={{color:'var(--text-secondary)',padding:16}}>No reference documents are available.</div>;
  }

  return (
    <div style={{display:'grid',gridTemplateColumns:'240px minmax(0,1fr)',gap:12,minHeight:0,height:'100%'}}>
      <aside style={{borderRight:'1px solid var(--border)',paddingRight:10,overflowY:'auto'}}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search references..." style={{width:'100%',marginBottom:10}} />
        <div style={{display:'grid',gap:6,marginBottom:12}}>
          {docs.map(option => (
            <button key={option.id} className={option.id === doc?.id ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
              onClick={() => { setDocId(option.id); setPageNumber(option.pages?.[0]?.page || 1); }}
              style={{textAlign:'left'}}>
              {option.title}
              <div style={{fontSize:10,color:option.id === doc?.id ? '#fff' : 'var(--text-dim)',fontWeight:500}}>{option.subtitle}</div>
            </button>
          ))}
        </div>
        {doc?.kind !== 'table' && (
          <div style={{display:'grid',gap:5}}>
            {visiblePages.map(option => (
              <button key={option.page} className="btn btn-secondary btn-sm" onClick={() => setPageNumber(option.page)}
                style={{
                  textAlign:'left',
                  borderColor:Number(option.page) === Number(page?.page) ? 'var(--accent)' : 'var(--border)',
                  background:Number(option.page) === Number(page?.page) ? 'rgba(124,92,252,0.16)' : 'var(--bg-secondary)',
                }}>
                <span style={{color:'var(--warning)',fontWeight:900}}>P{option.page}</span> {option.title}
                {option.subtitle && <div style={{fontSize:10,color:'var(--text-dim)',fontWeight:500}}>{option.subtitle}</div>}
              </button>
            ))}
          </div>
        )}
      </aside>
      <main style={{minWidth:0,overflowY:'auto',paddingRight:4}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline',marginBottom:8}}>
          <div>
            <h2 style={{color:'var(--accent-light)',fontSize:18,margin:'0 0 2px'}}>{doc?.kind === 'table' ? doc.title : `${doc?.title}: P${page?.page} ${page?.title || ''}`}</h2>
            <div style={{color:'var(--text-dim)',fontSize:11}}>{doc?.kind === 'table' ? doc.subtitle : page?.subtitle}</div>
          </div>
          <div style={{color:'var(--text-dim)',fontSize:10,textAlign:'right'}}>{doc?.source_file}</div>
        </div>
        {doc?.kind === 'table' ? (
          <ReboundTable doc={doc} query={query} />
        ) : blocks.length > 0 ? (
          blocks.map((block, idx) => <Block key={idx} block={block} />)
        ) : (
          <div style={{color:'var(--text-secondary)',padding:20,textAlign:'center'}}>No page text matched your search.</div>
        )}
      </main>
    </div>
  );
}

export default function ReferenceLibraryModal({ docsPayload, initialDocId, initialPage, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-flex modal-lg" onClick={e => e.stopPropagation()} style={{maxWidth:980,height:'84vh'}}>
        <div className="modal-header">
          <h2>Reference Library</h2>
        </div>
        <div className="modal-body" style={{minHeight:0}}>
          <ReferenceLibraryContent docsPayload={docsPayload} initialDocId={initialDocId} initialPage={initialPage} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" style={{width:'100%'}} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
