interface ButtonProps {
  onClick: () => void, 
  text: string;
}

export function Button({ onClick, text }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className="ml-4 bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
    >
      {text}
    </button>
  );
}
