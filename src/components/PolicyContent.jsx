export default function PolicyContent({ content }) {
  const blocks = Array.isArray(content) ? content : [];

  if (!blocks.length) {
    return <div className="sx-policy-note">Policy content is not available.</div>;
  }

  return (
    <div className="sx-policy-content">
      {blocks.map((block, index) => {
        const type = String(block?.type || 'paragraph');
        const text = String(block?.text || '').trim();
        const number = block?.number ? String(block.number).trim() : '';

        if (type === 'list') {
          const items = Array.isArray(block?.items) ? block.items : [];
          return (
            <ul key={`list-${index}`}>
              {items.map((item, itemIndex) => {
                const itemText = String(item?.text || '').trim();
                if (!itemText) return null;
                return <li key={`li-${index}-${itemIndex}`}>{itemText}</li>;
              })}
            </ul>
          );
        }

        if (!text) return null;

        if (type === 'title') {
          return <h2 key={`title-${index}`}>{text}</h2>;
        }

        if (type === 'heading') {
          return (
            <h3 key={`heading-${index}`}>
              {number ? `${number}. ` : ''}
              {text}
            </h3>
          );
        }

        if (type === 'note') {
          return (
            <div key={`note-${index}`} className="sx-policy-note">
              {text}
            </div>
          );
        }

        return (
          <p key={`p-${index}`}>
            {number ? <strong>{number} </strong> : null}
            {text}
          </p>
        );
      })}
    </div>
  );
}
