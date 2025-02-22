import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '@/interface/type';

interface BubbleProps {
  message: Message;
}

const Bubble: React.FC<BubbleProps> = ({ message }) => {
  return (
    <div className={`bubble ${message.role}`}>
      <ReactMarkdown>
        {message.content}
      </ReactMarkdown>
    </div>
  );
};

export default Bubble;
