import re

def update_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Add useState, useRef, useEffect
    if 'useState' not in content:
        content = content.replace("import React,", "import React, { useState, useRef, useEffect }")
    else:
        if 'useRef' not in content:
            content = content.replace("useState", "useState, useRef")
        if 'useEffect' not in content:
            content = content.replace("useState", "useState, useEffect")

    # 2. Add state inside the component
    state_code = """
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const scrollViewHeightRef = useRef<number>(0);

  useEffect(() => {
    setHasReachedBottom(false);
  }, [session.currentStep, session.viewAll]);
"""
    # Find the right place to insert
    content = re.sub(r'(const scrollProgress = useSharedValue\(0\);)', r'\1' + state_code, content)

    # 3. Update the scroll handler to set hasReachedBottom
    scroll_handler_update = """
        if (maxScroll <= 20 || isNearBottom) {
          runOnJS(setHasReachedBottom)(true);
        }
"""
    content = content.replace("const isNearBottom = currentY >= maxScroll - 30;", "const isNearBottom = currentY >= maxScroll - 30;" + scroll_handler_update)

    # 4. Update handleScrollViewLayout and handleContentSizeChange
    layout_update = """
  const handleScrollViewLayout = (e: any) => {
    scrollViewHeightRef.current = e.nativeEvent.layout.height;
  };

  const handleContentSizeChange = (w: number, h: number) => {
    const layoutH = scrollViewHeightRef.current;
    if (layoutH > 0 && h - layoutH <= 20) {
      setHasReachedBottom(true);
    }
  };
"""
    # Replace the existing handleScrollViewLayout if it exists
    if 'const handleScrollViewLayout' in content:
        content = re.sub(r'const handleScrollViewLayout.*?};', layout_update, content, flags=re.DOTALL)
    else:
        # Insert before return (
        content = content.replace("  return (", layout_update + "\n  return (")

    # 5. Add onContentSizeChange to ScrollView
    content = content.replace(
        "onLayout={handleScrollViewLayout}",
        "onLayout={handleScrollViewLayout}\n          onContentSizeChange={handleContentSizeChange}"
    )

    # 6. Pass nextDisabled to StepFooterNav
    content = content.replace(
        '<StepFooterNav completeLabel="Finalizar" />',
        '<StepFooterNav completeLabel="Finalizar" nextDisabled={!hasReachedBottom} />'
    )
    content = content.replace(
        '<StepFooterNav />',
        '<StepFooterNav nextDisabled={!hasReachedBottom} />'
    )

    with open(filepath, 'w') as f:
        f.write(content)

update_file('mobile/src/screens/classic/ClassicResultScreen.tsx')
update_file('mobile/src/screens/ResultScreen.tsx')
print("Updated screens")
