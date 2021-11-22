---
---

<test name="should render successfully with alert">
  {{% callout type="alert" %}}
  An alert type callout
  {{% /callout %}}
</test>

<test name="should render successfully with warning">
  {{% callout type="warning" %}}
  An warning type callout
  {{% /callout %}}
</test>


<test name="should throw error when missing type parameter">
  {{< expect error="Invalid callout's type '%!s(<nil>)'. Expecting one of 'alert warning'" >}}
  {{% callout %}}
  Something
  {{% /callout %}}
</test>

<test name="should throw error when invalid type">
  {{< expect error="Invalid callout's type 'invalid'. Expecting one of 'alert warning'" >}}
  {{% callout type="invalid" %}}
  Something
  {{% /callout %}}
</test>