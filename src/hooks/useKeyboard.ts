import { useState, useEffect } from 'react';

export function useKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      // If the visual viewport is significantly smaller than the window's inner height,
      // it means the virtual keyboard has opened.
      const isKeyboardOpenNow = window.visualViewport!.height < window.innerHeight - 100;
      setIsKeyboardOpen(isKeyboardOpenNow);

      if (isKeyboardOpenNow) {
        setKeyboardHeight(window.innerHeight - window.visualViewport!.height);
      } else {
        setKeyboardHeight(0);
      }
      
      // Prevent the body from scrolling out of bounds when keyboard opens
      if (isKeyboardOpenNow && document.documentElement.classList.contains('native-shell')) {
         window.scrollTo(0, 0);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    
    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return { isKeyboardOpen, keyboardHeight };
}
