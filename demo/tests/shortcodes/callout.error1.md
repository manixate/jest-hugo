---
---
<test name="should show error when missing type parameter.">
  {{< expect error="Invalid callout's type '%!s(<nil>)'. Expecting one of 'alert warning'" >}}
  {{% callout %}}
  An note type callout
  {{% /callout %}}
</test>