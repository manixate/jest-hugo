---
---

<test name="should throw error when invalid type">
  {{< expect error="Invalid callout's type 'invalid'. Expecting one of 'alert warning'" >}}
  {{% callout type="invalid" %}}
  Something
  {{% /callout %}}
</test>
