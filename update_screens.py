import re

def update_file(filename):
    with open(filename, 'r') as f:
        content = f.read()

    # Remove footerAnimatedStyle and footerAnimatedProps imports
    content = content.replace("  useAnimatedProps,\n", "")
    content = content.replace("  useAnimatedStyle,\n", "")
    
    # In case they were in the same line or imported from react-native-reanimated
    content = re.sub(r'const footerAnimatedStyle = .*?}\);\n', '', content, flags=re.DOTALL)
    content = re.sub(r'const footerAnimatedProps = .*?}\);\n', '', content, flags=re.DOTALL)
    
    # Remove animated footer wrapper
    content = content.replace(
        '<Animated.View style={footerAnimatedStyle} animatedProps={footerAnimatedProps}>\n            <StepFooterNav completeLabel="Finalizar" />\n          </Animated.View>',
        '<StepFooterNav completeLabel="Finalizar" />'
    )
    content = content.replace(
        '<Animated.View style={footerAnimatedStyle} animatedProps={footerAnimatedProps}>\n            <StepFooterNav />\n          </Animated.View>',
        '<StepFooterNav />'
    )

    with open(filename, 'w') as f:
        f.write(content)

update_file('mobile/src/screens/classic/ClassicResultScreen.tsx')
update_file('mobile/src/screens/ResultScreen.tsx')
print("Done")
