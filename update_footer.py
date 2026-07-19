import os

filepath = 'mobile/src/components/StepFooterNav.tsx'
with open(filepath, 'r') as f:
    content = f.read()

# Add nextDisabled to props
content = content.replace("type StepFooterNavProps = {", "type StepFooterNavProps = {\n  nextDisabled?: boolean;")
content = content.replace("export default function StepFooterNav({ completeLabel = 'Completar mapa' }: StepFooterNavProps) {", "export default function StepFooterNav({ completeLabel = 'Completar mapa', nextDisabled }: StepFooterNavProps) {")

# Apply nextDisabled to forwardSlot
content = content.replace('<View style={styles.forwardSlot}>', '<View style={[styles.forwardSlot, nextDisabled && { opacity: 0.5, pointerEvents: \'none\' }]}>')

with open(filepath, 'w') as f:
    f.write(content)

print("Updated StepFooterNav.tsx")
