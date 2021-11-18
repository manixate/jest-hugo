---
---
<test name="should show error when enter invalid type.">
  {{< expect error="Invalid callout's type 'invalid'. Expecting one of 'alert warning'" >}}
  {{% callout type="invalid" %}}
  An note type callout
  {{% /callout %}}
</test>