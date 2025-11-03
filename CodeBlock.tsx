import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from './icons/Icons';

interface CodeBlockProps {
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-900 rounded-md my-2 text-sm text-left">
      <div className="flex items-center justify-between px-4 py-1.5 bg-gray-800 rounded-t-md">
        <span className="text-xs text-gray-400">Code</span>
        <button onClick={handleCopy} className="flex items-center text-xs text-gray-400 hover:text-white transition-colors">
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="ml-1.5">{copied ? 'Copied!' : 'Copy code'}</span>
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-gray-200">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;