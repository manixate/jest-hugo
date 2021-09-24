---
---
<test name="should render successful with alert">
  {{% callout type="alert" %}}
  An alert type callout
  {{% /callout %}}
</test>

<test name="should render successful with warning">
  {{% callout type="warning" %}}
  An warning type callout
  {{% /callout %}}
</test>

<test name="should show error when missing type parameter.">
  {{< expect error="Invalid callout's type '%!s(<nil>)'. Expecting one of 'alert warning'" >}}
  {{% callout %}}
  An note type callout
  {{% /callout %}}
</test>

<test name="should show error when enter invalid type.">
  {{< expect error="Invalid callout's type 'invalid'. Expecting one of 'alert warning'" >}}
  {{% callout type="invalid" %}}
  An note type callout
  {{% /callout %}}
</test>

<test name="should 2 show error when enter invalid type.">
  {{< expect error="Invalid callout's type 'invalid'. Expecting one of 'alert warning'" >}}
  {{% callout type="invalid" %}}
  An note type callout
  {{% /callout %}}
</test>