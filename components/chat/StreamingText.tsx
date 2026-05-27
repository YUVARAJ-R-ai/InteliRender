import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StreamingTextProps {
  content: string;
}

export function StreamingText({ content }: StreamingTextProps) {
  return (
    <div className="text-sm space-y-4">
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({node, ...props}) => <p className="leading-relaxed" {...props} />,
          a: ({node, ...props}) => <a className="text-blue-500 hover:underline" {...props} />,
          ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1" {...props} />,
          ol: ({node, ...props}) => <ol className="list-decimal list-inside space-y-1" {...props} />,
          li: ({node, ...props}) => <li className="ml-4" {...props} />,
          code: ({node, ...props}) => <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-xs" {...props} />,
          pre: ({node, ...props}) => <pre className="bg-muted p-4 rounded-md overflow-x-auto my-4 text-xs font-mono" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
